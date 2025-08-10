import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/client';
import crypto from 'crypto';
import { clearAllCache } from '@/lib/cache';

/*
  Admin API: organization_data → organization_master 동기화
  - 신규 코드 upsert
  - 이름/부모/레벨 변경 반영
  - 존재하지 않는 코드는 비활성화(is_active = 0)
  - POST body { dryRun?: boolean }
*/

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const dryRun = Boolean(body?.dryRun);

    const tx = db.transaction(() => {
      // 1) organization_data 스키마 동적 확인 및 컬럼 매핑
      const columns = db.prepare(`PRAGMA table_info(organization_data)`).all() as any[];
      const colNames = new Set((columns || []).map(c => String(c.name).toLowerCase()));

      const findCol = (...candidates: string[]) => {
        for (const c of candidates) {
          if (colNames.has(c.toLowerCase())) return c;
        }
        return null;
      };

      const orgCodeCol = findCol('org_code', 'organization_code', 'orgcode', 'code', 'id');
      const orgNameCol = findCol('org_name', 'organization_name', 'name', 'orgname');
      const orgLevelCol = findCol('org_level', 'level', 'orglevel');
      const parentCol = findCol('parent_org_code', 'parent_code', 'parent', 'parent_org');
      const orderCol = findCol('display_order', 'order', 'sort_order', 'displayorder');

      let rows: any[] = [];
      if (orgCodeCol && orgNameCol && orgLevelCol) {
        // 표준 스키마 경로
        const selectSQL = `
          SELECT 
            ${orgCodeCol} as orgCode,
            ${orgNameCol} as orgName,
            ${orgLevelCol} as orgLevel,
            ${parentCol ? parentCol : 'NULL'} as parentOrgCode,
            ${orderCol ? orderCol : 'NULL'} as displayOrder
          FROM organization_data
        `;
        rows = db.prepare(selectSQL).all() as any[];
      } else {
        // 한국어 컬럼 기반 동기화 (센터 / BU / 팀 / 그룹 / 부서코드 / 부서명)
        const centerCol = findCol('센터');
        const buCol = findCol('BU', 'Bu', 'bu');
        const teamCol = findCol('팀');
        const groupCol = findCol('그룹');
        const deptCodeCol = findCol('부서코드', '내부부서코드');
        const deptNameCol = findCol('부서명');

        if (!centerCol || !deptNameCol) {
          throw new Error(`organization_data 컬럼을 찾을 수 없습니다. (필수: 센터, 부서명). 실제 컬럼: ${[...colNames].join(', ')}`);
        }

        const raw = db.prepare(`
          SELECT 
            ${centerCol} as center,
            ${buCol ? buCol : 'NULL'} as bu,
            ${teamCol ? teamCol : 'NULL'} as team,
            ${groupCol ? groupCol : 'NULL'} as grp,
            ${deptCodeCol ? deptCodeCol : 'NULL'} as deptCode,
            ${deptNameCol} as deptName
          FROM organization_data
        `).all() as any[];

        const makeCode = (prefix: string, key: string) => `${prefix}_${crypto.createHash('md5').update(key).digest('hex').slice(0,8)}`;
        const setCenter = new Map<string, string>();
        const setDivision = new Map<string, { code: string, parent: string }>();
        const setTeam = new Map<string, { code: string, parent: string }>();
        const setGroup = new Map<string, { code: string, parent: string, name: string }>();

        const isPlaceholder = (s?: string) => {
          const v = (s || '').toString().trim();
          if (!v) return true;
          const lowered = v.toLowerCase();
          return v === '-' || v === '—' || v === '–' || lowered === 'n/a' || lowered === 'null';
        };

        for (const r of raw) {
          const centerName = (r.center || '').toString().trim();
          if (!centerName) continue;
          const buName = (r.bu || '').toString().trim();
          const teamName = (r.team || '').toString().trim();
          const groupName = (r.grp || r.deptName || '').toString().trim();
          const deptCode = (r.deptCode || '').toString().trim();

          // center
          let centerCode = setCenter.get(centerName);
          if (!centerCode) {
            centerCode = makeCode('CENTER', centerName);
            setCenter.set(centerName, centerCode);
          }

          // division (BU)
          if (buName && !isPlaceholder(buName)) {
            const key = `${centerName}>${buName}`;
            if (!setDivision.has(key)) {
              setDivision.set(key, { code: makeCode('DIV', key), parent: centerCode });
            }
          }

          // team (담당명과 동일한 팀명은 생성하지 않음 → 중복 방지)
          if (teamName && !isPlaceholder(teamName) && teamName !== buName && teamName !== centerName) {
            const key = `${centerName}>${buName}>${teamName}`;
            const parentCode = buName ? setDivision.get(`${centerName}>${buName}`)?.code || centerCode : centerCode;
            if (!setTeam.has(key)) {
              setTeam.set(key, { code: makeCode('TEAM', key), parent: parentCode! });
            }
          }

          // group (leaf)
          if ((groupName && !isPlaceholder(groupName)) || deptCode) {
            const key = `${centerName}>${buName}>${teamName}>${groupName || deptCode}`;
            const parentKey = `${centerName}>${buName}>${teamName}`;
            const parentCode = setTeam.get(parentKey)?.code || (buName ? setDivision.get(`${centerName}>${buName}`)?.code : setCenter.get(centerName));
            const code = deptCode ? deptCode : makeCode('GROUP', key);
            // BU명과 동일하거나 팀명과 동일한 그룹명은 생성하지 않음 (중복 방지)
            if (!setGroup.has(key) && parentCode && groupName !== buName && groupName !== teamName && groupName !== centerName) {
              setGroup.set(key, { code, parent: parentCode, name: groupName || deptCode });
            }
          }
        }

        // rows로 변환 (center → division → team → group)
        rows = [];
        for (const [name, code] of setCenter.entries()) {
          rows.push({ orgCode: code, orgName: name, orgLevel: 'center', parentOrgCode: null, displayOrder: 0 });
        }
        for (const [key, v] of setDivision.entries()) {
          const name = key.split('>').slice(-1)[0];
          rows.push({ orgCode: v.code, orgName: name, orgLevel: 'division', parentOrgCode: v.parent, displayOrder: 0 });
        }
        for (const [key, v] of setTeam.entries()) {
          const name = key.split('>').slice(-1)[0];
          rows.push({ orgCode: v.code, orgName: name, orgLevel: 'team', parentOrgCode: v.parent, displayOrder: 0 });
        }
        for (const [key, v] of setGroup.entries()) {
          rows.push({ orgCode: v.code, orgName: v.name, orgLevel: 'group', parentOrgCode: v.parent, displayOrder: 0 });
        }
      }

      // 2) 마스터 존재 여부 맵핑
      const masterRows = db.prepare(`SELECT org_code as orgCode FROM organization_master`).all() as any[];
      const masterSet = new Set(masterRows.map(r => r.orgCode));

      // 3) upsert/update
      const upsertStmt = db.prepare(`
        INSERT INTO organization_master (org_code, org_name, org_level, parent_org_code, display_order, is_active)
        VALUES (@orgCode, @orgName, @orgLevel, @parentOrgCode, COALESCE(@displayOrder, 0), 1)
        ON CONFLICT(org_code) DO UPDATE SET
          org_name = excluded.org_name,
          org_level = excluded.org_level,
          parent_org_code = excluded.parent_org_code,
          display_order = excluded.display_order,
          is_active = 1
      `);

      if (!dryRun) {
        for (const row of rows) {
          upsertStmt.run(row);
          masterSet.delete(row.orgCode);
        }
      }

      // 4) organization_data에 더 이상 없는 마스터는 is_active = 0 처리
      const deactivateStmt = db.prepare(`
        UPDATE organization_master SET is_active = 0 WHERE org_code = ?
      `);
      if (!dryRun) {
        for (const orphan of masterSet) {
          deactivateStmt.run(orphan);
        }
      }
    });

    tx();

    // 캐시 무효화 (dashboard/teams/groups)
    clearAllCache();
    return NextResponse.json({ ok: true, dryRun, message: 'organization_master synced and cache cleared' });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}


