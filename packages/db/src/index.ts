/** Public API of the Odyssey data layer — node:sqlite, WAL, ordered migrations. */
export { openDatabase, resolveDatabasePath, type DatabaseKind } from "./client";
export {
  learningDb,
  withLearningTransaction,
  createLearningAttemptWrite,
} from "./repositories/learning";
export {
  withGoldDatabase,
  resolveGoldDatabasePath,
} from "./repositories/gold-database";
export {
  listGoldRecords,
  getGoldStats,
  getGoldTopics,
  resolveGoldRecordsForAssessment,
  type GoldRecordSummary,
  type GoldStats,
  type ResolvedGoldRecord,
} from "./repositories/gold-query";
export { getBrowseTree, getStandardsForSelection } from "./repositories/browse";
export { ensureCatalogSeeded, reviewedCatalogSize } from "./catalog-seed";
export { default as sqliteQueries } from "./sqlite-queries.json";
