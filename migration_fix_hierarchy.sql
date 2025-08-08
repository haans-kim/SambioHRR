-- Fix Migration Script: Properly set up 4-level hierarchy
-- This script fixes the issues from the previous migration

BEGIN TRANSACTION;

-- 1. First, let's see what '담당' groups exist under '담당' teams
CREATE TEMPORARY TABLE temp_fix AS
SELECT 
    t.org_code as division_code,
    t.org_name as division_name,
    t.parent_org_code as center_code,
    g.org_code as team_code,
    g.org_name as team_name,
    g.parent_org_code as old_parent
FROM organization_master t
JOIN organization_master g ON g.parent_org_code = t.org_code
WHERE t.org_level = 'division' AND g.org_level = 'team';

-- 2. For divisions that have a team with the same name, remove the duplicate
DELETE FROM organization_master
WHERE org_code IN (
    SELECT team_code 
    FROM temp_fix 
    WHERE division_name = team_name
);

-- 3. Update remaining teams to have correct parent (should be under division)
UPDATE organization_master
SET parent_org_code = (
    SELECT division_code 
    FROM temp_fix 
    WHERE temp_fix.team_code = organization_master.org_code
)
WHERE org_code IN (
    SELECT team_code 
    FROM temp_fix 
    WHERE division_name != team_name
);

-- 4. Reassign groups that lost their parent (from deleted duplicate teams)
UPDATE organization_master
SET parent_org_code = (
    SELECT t.division_code
    FROM temp_fix t
    WHERE t.team_code = organization_master.parent_org_code
)
WHERE org_level = 'group' 
  AND parent_org_code IN (
    SELECT team_code 
    FROM temp_fix 
    WHERE division_name = team_name
);

-- 5. Update these reassigned groups to become teams under divisions
UPDATE organization_master
SET org_level = 'team'
WHERE org_level = 'group' 
  AND parent_org_code IN (
    SELECT org_code 
    FROM organization_master 
    WHERE org_level = 'division'
);

-- 6. Clean up
DROP TABLE IF EXISTS temp_fix;

-- 7. Verify the fix
SELECT 
    'After Fix - Level Summary' as info,
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

-- 8. Show sample hierarchy for verification
SELECT '=== Sample Fixed Hierarchy (CENTER_002) ===' as section;
SELECT 
    CASE 
        WHEN om.org_level = 'center' THEN om.org_name
        WHEN om.org_level = 'division' THEN '  └─ ' || om.org_name
        WHEN om.org_level = 'team' THEN '      └─ ' || om.org_name
        WHEN om.org_level = 'group' THEN '          └─ ' || om.org_name
    END as hierarchy,
    om.org_level,
    om.parent_org_code
FROM (
    -- Centers
    SELECT org_code, org_name, org_level, parent_org_code, 1 as sort_order
    FROM organization_master 
    WHERE org_level = 'center' AND org_code = 'CENTER_002'
    
    UNION ALL
    
    -- Divisions under CENTER_002
    SELECT org_code, org_name, org_level, parent_org_code, 2 as sort_order
    FROM organization_master 
    WHERE org_level = 'division' AND parent_org_code = 'CENTER_002'
    
    UNION ALL
    
    -- Teams under divisions of CENTER_002
    SELECT t.org_code, t.org_name, t.org_level, t.parent_org_code, 3 as sort_order
    FROM organization_master t
    WHERE t.org_level = 'team' 
      AND t.parent_org_code IN (
        SELECT org_code FROM organization_master 
        WHERE org_level = 'division' AND parent_org_code = 'CENTER_002'
      )
    
    UNION ALL
    
    -- Teams directly under CENTER_002 (no division)
    SELECT org_code, org_name, org_level, parent_org_code, 3 as sort_order
    FROM organization_master 
    WHERE org_level = 'team' AND parent_org_code = 'CENTER_002'
    
    UNION ALL
    
    -- Groups
    SELECT g.org_code, g.org_name, g.org_level, g.parent_org_code, 4 as sort_order
    FROM organization_master g
    WHERE g.org_level = 'group'
      AND g.parent_org_code IN (
        SELECT org_code FROM organization_master 
        WHERE org_level = 'team' 
          AND (parent_org_code = 'CENTER_002' 
               OR parent_org_code IN (
                 SELECT org_code FROM organization_master 
                 WHERE org_level = 'division' AND parent_org_code = 'CENTER_002'
               ))
      )
) om
ORDER BY sort_order, om.org_name
LIMIT 20;