#!/bin/sh
# Sicherungsschleife für den Docker-Betrieb.
#
# Bewusst ein eigenes Skript statt einer Schleife in docker-compose.yml: Dort
# müsste jedes Dollarzeichen verdoppelt werden, damit Compose es nicht selbst
# ersetzt — ein Fehler, den man erst bemerkt, wenn die Sicherung seit Wochen
# nicht läuft. Hier ist es gewöhnliche Shell und lässt sich ausprobieren.
#
# ONTRACK_BACKUP_INTERVAL  Sekunden zwischen zwei Läufen (Standard: täglich)
# ONTRACK_BACKUP_DELAY     Vorlauf beim Start, damit die App ihre Migrationen
#                          durch hat (Standard: 60 s)
# ONTRACK_BACKUP_ONCE      gesetzt = nur ein Lauf, dann Ende (für Tests)

set -eu

ABSTAND="${ONTRACK_BACKUP_INTERVAL:-86400}"
VORLAUF="${ONTRACK_BACKUP_DELAY:-60}"

sleep "$VORLAUF"

while true; do
  # Ein Fehlschlag beendet die Schleife nicht: Ein voller Datenträger oder
  # eine kurz gesperrte Datenbank sind Gründe, es später erneut zu versuchen,
  # kein Grund, die Sicherung für immer einzustellen.
  node scripts/backup.mjs || echo "Sicherung fehlgeschlagen, nächster Versuch in ${ABSTAND}s"

  if [ -n "${ONTRACK_BACKUP_ONCE:-}" ]; then
    break
  fi

  sleep "$ABSTAND"
done
