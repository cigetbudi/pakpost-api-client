START TRANSACTION;
ALTER TABLE collection.collections ADD parent_collection_id uuid;

ALTER TABLE collection.collections ADD sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX "IX_collections_parent_collection_id" ON collection.collections (parent_collection_id);

CREATE INDEX "IX_collections_WorkspaceId_ParentCollectionId_SortOrder" ON collection.collections ("WorkspaceId", parent_collection_id, sort_order);

ALTER TABLE collection.collections ADD CONSTRAINT "FK_collections_collections_parent_collection_id" FOREIGN KEY (parent_collection_id) REFERENCES collection.collections ("Id") ON DELETE RESTRICT;

ALTER TABLE collection.collections ADD CONSTRAINT ck_collection_no_self_parent CHECK (parent_collection_id IS NULL OR parent_collection_id <> "Id")

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261120100000_CollectionHierarchy', '10.0.15');

COMMIT;

