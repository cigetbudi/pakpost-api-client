START TRANSACTION;
ALTER TABLE collection.saved_requests ADD sort_order integer NOT NULL DEFAULT 2147483647;

WITH ranked AS (
    SELECT "Id", ROW_NUMBER() OVER
      (PARTITION BY "CollectionId", "FolderId" ORDER BY "Name", "Id") AS ord
    FROM collection.saved_requests
)
UPDATE collection.saved_requests AS req SET sort_order = ranked.ord
FROM ranked WHERE req."Id" = ranked."Id";

CREATE INDEX "IX_saved_requests_CollectionId_FolderId_SortOrder_Id" ON collection.saved_requests ("CollectionId", "FolderId", sort_order, "Id");

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261120120000_RequestManualSortOrder', '10.0.15');

COMMIT;

