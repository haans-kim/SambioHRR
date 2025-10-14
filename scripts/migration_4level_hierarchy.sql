-- Migration Script: 3-level to 4-level hierarchy
-- Date: 2024
-- Purpose: Add division level between center and team for organizations with '담당'

-- 1. Create backup table
CREATE TABLE IF NOT EXISTS organization_master_backup_migration AS
SELECT * FROM organization_master;

-- 2. Begin transaction for safe migration
BEGIN TRANSACTION;

-- 3. Update org_level for '담당' teams to 'division'
UPDATE organization_master
SET org_level = 'division'
WHERE org_level = 'team' 
  AND org_name LIKE '%담당%';

-- 4. Update parent relationships for teams under divisions
-- First, identify and store the relationships
CREATE TEMPORARY TABLE temp_division_teams AS
SELECT 
    d.org_code as division_code,
    d.org_name as division_name,
    d.parent_org_code as center_code,
    g.org_code as team_code,
    g.org_name as team_name
FROM organization_master d
JOIN organization_master g ON g.parent_org_code = d.org_code
WHERE d.org_level = 'division' 
  AND g.org_level = 'group';

-- 5. Update groups that were incorrectly set as children of divisions to become teams
UPDATE organization_master
SET org_level = 'team'
WHERE org_code IN (
    SELECT team_code FROM temp_division_teams
);

-- 6. Create new org codes for actual groups under the new teams
-- This step requires analyzing the existing structure more carefully
-- For now, we'll keep the existing structure and only update the levels

-- 7. Update display_order to maintain proper hierarchy
UPDATE organization_master
SET display_order = display_order * 10
WHERE org_level = 'center';

UPDATE organization_master
SET display_order = 
    (SELECT om1.display_order + 1 
     FROM organization_master om1 
     WHERE om1.org_code = organization_master.parent_org_code)
WHERE org_level = 'division';

UPDATE organization_master
SET display_order = 
    CASE 
        WHEN parent_org_code IN (SELECT org_code FROM organization_master WHERE org_level = 'division')
        THEN (SELECT om1.display_order + 1 
              FROM organization_master om1 
              WHERE om1.org_code = organization_master.parent_org_code)
        ELSE (SELECT om1.display_order + 2 
              FROM organization_master om1 
              WHERE om1.org_code = organization_master.parent_org_code)
    END
WHERE org_level = 'team';

-- 8. Verify the migration
SELECT 
    'Migration Summary' as info,
    (SELECT COUNT(*) FROM organization_master WHERE org_level = 'center') as centers,
    (SELECT COUNT(*) FROM organization_master WHERE org_level = 'division') as divisions,
    (SELECT COUNT(*) FROM organization_master WHERE org_level = 'team') as teams,
    (SELECT COUNT(*) FROM organization_master WHERE org_level = 'group') as groups;

-- 9. Clean up temporary table
DROP TABLE IF EXISTS temp_division_teams;

-- 10. Commit the transaction
COMMIT;

-- 11. Verification queries
SELECT '=== Centers with Divisions ===' as section;
SELECT DISTINCT c.org_name as center, d.org_name as division
FROM organization_master c
JOIN organization_master d ON d.parent_org_code = c.org_code
WHERE c.org_level = 'center' AND d.org_level = 'division'
ORDER BY c.org_name;

SELECT '=== Sample Hierarchy ===' as section;
SELECT 
    CASE org_level
        WHEN 'center' THEN org_name
        WHEN 'division' THEN '  ├─ ' || org_name
        WHEN 'team' THEN '    ├─ ' || org_name
        WHEN 'group' THEN '      └─ ' || org_name
    END as hierarchy
FROM organization_master
WHERE org_code IN (
    SELECT org_code FROM organization_master WHERE org_level = 'center' AND org_code = 'CENTER_002'
    UNION ALL
    SELECT org_code FROM organization_master WHERE parent_org_code = 'CENTER_002'
    UNION ALL
    SELECT t.org_code FROM organization_master d
    JOIN organization_master t ON t.parent_org_code = d.org_code
    WHERE d.parent_org_code = 'CENTER_002'
    UNION ALL
    SELECT g.org_code FROM organization_master d
    JOIN organization_master t ON t.parent_org_code = d.org_code
    JOIN organization_master g ON g.parent_org_code = t.org_code
    WHERE d.parent_org_code = 'CENTER_002'
)
ORDER BY display_order;