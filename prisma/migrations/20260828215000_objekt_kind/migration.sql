-- Neue Spalte: Art der Veranstaltung (Veranstaltung oder Festinstallation).
ALTER TABLE "Event" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'VERANSTALTUNG';

-- endDate wird optional. SQLite kann eine Spalte nicht lockern, deshalb der
-- Umweg über eine neue Tabelle. Bestehende Zeilen behalten ihr Enddatum.
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'VERANSTALTUNG',
    "venue" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "notes" TEXT,
    "planImage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "new_Event" ("id", "name", "kind", "venue", "startDate", "endDate", "notes", "planImage", "createdAt")
SELECT "id", "name", "kind", "venue", "startDate", "endDate", "notes", "planImage", "createdAt" FROM "Event";

DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";

PRAGMA foreign_keys=ON;
