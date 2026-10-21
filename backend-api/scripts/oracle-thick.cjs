// Explicit startup opt-in for Oracle Client / legacy database deployments.
// Loading errors must stop startup rather than silently switching to Thin mode.
require('oracledb').initOracleClient();
