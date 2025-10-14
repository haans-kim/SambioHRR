-- Migration Script V2: Add division level for 4-tier hierarchy
-- This version carefully handles the transition

BEGIN TRANSACTION;

-- Step 1: Add 'division' level to org_level (if column needs modification)
-- SQLite doesn't support ALTER COLUMN, so we'll work with existing structure

-- Step 2: Create divisions from teams with '담당' in name
-- These 9 teams will become divisions
INSERT INTO organization_master (org_code, org_name, org_level, parent_org_code, display_order, is_active)
SELECT 
    'DIV_' || SUBSTR(org_code, 6) as org_code,  -- Convert TEAM_XXXX to DIV_XXXX
    org_name,
    'division' as org_level,
    parent_org_code,
    display_order,
    is_active
FROM organization_master
WHERE org_level = 'team' 
  AND org_name LIKE '%담당%';

-- Step 3: Update the original '담당' teams to be children of the new divisions
-- and remove '담당' from their names if they'll remain as teams
UPDATE organization_master
SET 
    parent_org_code = 'DIV_' || SUBSTR(org_code, 6),
    org_name = REPLACE(org_name, '담당', '팀')
WHERE org_level = 'team' 
  AND org_name LIKE '%담당%';

-- Step 4: Move groups under '담당' teams to be under the modified teams
-- No change needed as parent relationship is maintained

-- Step 5: Update display order for proper hierarchy display
UPDATE organization_master
SET display_order = display_order * 100
WHERE org_level = 'center';

UPDATE organization_master
SET display_order = 
    (SELECT om1.display_order + 10 
     FROM organization_master om1 
     WHERE om1.org_code = organization_master.parent_org_code)
WHERE org_level = 'division';

UPDATE organization_master
SET display_order = 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM organization_master d 
            WHERE d.org_code = organization_master.parent_org_code 
              AND d.org_level = 'division'
        )
        THEN (SELECT om1.display_order + 1 
              FROM organization_master om1 
              WHERE om1.org_code = organization_master.parent_org_code)
        ELSE (SELECT om1.display_order + 20 
              FROM organization_master om1 
              WHERE om1.org_code = organization_master.parent_org_code)
    END
WHERE org_level = 'team';

-- Step 6: Verify the migration
SELECT 
    'Level Count After Migration' as status,
    org_level,
    COUNT(*) as count
FROM organization_master
GROUP BY org_level
ORDER BY 
    CASE org_level
        WHEN 'center' THEN 1
        WHEN 'division' THEN 2
        WHEN 'team' THEN 3
        WHEN 'group' THEN 4
    END;

COMMIT;

-- Step 7: Show the new hierarchy structure
SELECT '=== Centers with Divisions ===' as info;
SELECT DISTINCT 
    c.org_code as center_code,
    c.org_name as center,
    d.org_code as division_code,
    d.org_name as division
FROM organization_master c
JOIN organization_master d ON d.parent_org_code = c.org_code
WHERE c.org_level = 'center' 
  AND d.org_level = 'division'
ORDER BY c.org_name;

SELECT '=== Sample 4-Level Hierarchy (CENTER_002) ===' as info;
SELECT 
    CASE 
        WHEN org_level = 'center' THEN org_name
        WHEN org_level = 'division' THEN '  ├─ ' || org_name
        WHEN org_level = 'team' THEN '    ├─ ' || org_name
        WHEN org_level = 'group' THEN '      └─ ' || org_name
    END as hierarchy,
    org_code,
    parent_org_code
FROM organization_master
WHERE org_code = 'CENTER_002'
   OR parent_org_code = 'CENTER_002'
   OR parent_org_code IN (
       SELECT org_code FROM organization_master 
       WHERE parent_org_code = 'CENTER_002'
   )
   OR parent_org_code IN (
       SELECT t.org_code FROM organization_master d
       JOIN organization_master t ON t.parent_org_code = d.org_code
       WHERE d.parent_org_code = 'CENTER_002'
   )
ORDER BY display_order
LIMIT 30;