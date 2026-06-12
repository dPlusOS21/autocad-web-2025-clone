<?php
/**
 * API REST per WebCAD: gestione progetti
 *
 *   GET    api.php?action=list                  -> elenco
 *   GET    api.php?action=load&id=N             -> carica documento
 *   POST   api.php?action=save                  -> salva (id opzionale)
 *   POST   api.php?action=rename                -> { id, name }
 *   POST   api.php?action=delete                -> { id }
 */
declare(strict_types=1);
require_once __DIR__ . '/db.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$action = $_GET['action'] ?? '';
$db = getDb();

try {
    switch ($action) {

        case 'list': {
            $rows = $db->query(
                "SELECT id, name, updated_at, thumb FROM projects ORDER BY updated_at DESC"
            )->fetchAll(PDO::FETCH_ASSOC);
            jsonOut(['ok' => true, 'projects' => $rows]);
        }

        case 'load': {
            $id = (int)($_GET['id'] ?? 0);
            if ($id <= 0) jsonErr('id mancante');
            $stmt = $db->prepare("SELECT id, name, data FROM projects WHERE id = ?");
            $stmt->execute([$id]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row) jsonErr('progetto non trovato', 404);
            jsonOut([
                'ok' => true,
                'id' => (int)$row['id'],
                'name' => $row['name'],
                'doc' => json_decode($row['data'], true),
            ]);
        }

        case 'save': {
            $input = json_decode(file_get_contents('php://input'), true);
            if (!is_array($input)) jsonErr('payload JSON invalido');
            $name = trim((string)($input['name'] ?? 'Senza titolo'));
            $doc = $input['doc'] ?? null;
            $thumb = $input['thumb'] ?? null;
            $id = isset($input['id']) ? (int)$input['id'] : 0;
            if (!$doc) jsonErr('documento mancante');
            $json = json_encode($doc, JSON_UNESCAPED_UNICODE);

            if ($id > 0) {
                $stmt = $db->prepare(
                    "UPDATE projects SET name=?, data=?, thumb=?, updated_at=CURRENT_TIMESTAMP WHERE id=?"
                );
                $stmt->execute([$name, $json, $thumb, $id]);
                if ($stmt->rowCount() === 0) jsonErr('progetto non trovato', 404);
            } else {
                $stmt = $db->prepare(
                    "INSERT INTO projects (name, data, thumb) VALUES (?, ?, ?)"
                );
                $stmt->execute([$name, $json, $thumb]);
                $id = (int)$db->lastInsertId();
            }
            jsonOut(['ok' => true, 'id' => $id, 'name' => $name]);
        }

        case 'rename': {
            $input = json_decode(file_get_contents('php://input'), true);
            $id = (int)($input['id'] ?? 0);
            $name = trim((string)($input['name'] ?? ''));
            if ($id <= 0 || $name === '') jsonErr('parametri invalidi');
            $stmt = $db->prepare("UPDATE projects SET name=?, updated_at=CURRENT_TIMESTAMP WHERE id=?");
            $stmt->execute([$name, $id]);
            jsonOut(['ok' => true]);
        }

        case 'delete': {
            $input = json_decode(file_get_contents('php://input'), true);
            $id = (int)($input['id'] ?? 0);
            if ($id <= 0) jsonErr('id mancante');
            $db->prepare("DELETE FROM projects WHERE id = ?")->execute([$id]);
            jsonOut(['ok' => true]);
        }

        default:
            jsonErr('azione sconosciuta: ' . $action, 404);
    }
} catch (Throwable $e) {
    jsonErr('errore server: ' . $e->getMessage(), 500);
}
