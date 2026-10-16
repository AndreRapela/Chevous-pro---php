<?php

declare(strict_types=1);

const ROOT = '/storage';

function checkedPath(string $path): string
{
    $parts = explode('/', $path);
    foreach ($parts as $part) {
        if (
            $part === '' ||
            $part === '.' ||
            $part === '..' ||
            $part === '.git' ||
            preg_match('/^\.env(?:\.|$)/i', $part) ||
            preg_match('/[\\\\:\x00-\x1f]/', $part)
        ) {
            throw new RuntimeException('Caminho de armazenamento inseguro.');
        }
    }
    return ROOT . '/' . $path;
}

function inventory(): array
{
    $entries = [];
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator(ROOT, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST,
    );
    foreach ($iterator as $file) {
        $path = substr($file->getPathname(), strlen(ROOT) + 1);
        // Não embutir arquivos de ambiente, mesmo que tenham sido enviados ao storage.
        if (preg_match('~(?:^|/)(?:\.env(?:\.[^/]*)?|\.git)(?:/|$)~i', $path)) {
            continue;
        }
        checkedPath($path);
        if ($file->isLink() || (!$file->isDir() && !$file->isFile())) {
            throw new RuntimeException('Links e arquivos especiais não são aceitos no backup.');
        }
        $entry = ['path' => $path, 'type' => $file->isDir() ? 'directory' : 'file'];
        if ($entry['type'] === 'file') {
            $content = file_get_contents($file->getPathname());
            if ($content === false) {
                throw new RuntimeException('Falha ao ler armazenamento.');
            }
            $entry['content'] = base64_encode($content);
        }
        $entries[] = $entry;
    }
    usort($entries, fn(array $a, array $b): int => strcmp($a['path'], $b['path']));
    return $entries;
}

function requireEmptyVolume(): void
{
    if (new FilesystemIterator(ROOT, FilesystemIterator::SKIP_DOTS)->valid()) {
        throw new RuntimeException('A restauração exige um volume completamente vazio.');
    }
}

try {
    if (($argv[1] ?? '') === 'export') {
        echo json_encode(inventory(), JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
    } elseif (($argv[1] ?? '') === 'check-empty') {
        requireEmptyVolume();
        echo "Volume vazio.\n";
    } elseif (($argv[1] ?? '') === 'restore') {
        $entries = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
        requireEmptyVolume();
        if (!is_array($entries)) {
            throw new RuntimeException('Inventário inválido.');
        }
        foreach ($entries as $entry) {
            $path = checkedPath($entry['path']);
            if (!in_array($entry['type'], ['directory', 'file'], true)) {
                throw new RuntimeException('Tipo de arquivo inválido.');
            }
        }
        foreach ($entries as $entry) {
            $path = checkedPath($entry['path']);
            $directory = $entry['type'] === 'directory' ? $path : dirname($path);
            if (!is_dir($directory) && !mkdir($directory, 0755, true)) {
                throw new RuntimeException('Falha ao criar diretório.');
            }
            if ($entry['type'] === 'file') {
                $content = base64_decode($entry['content'], true);
                if ($content === false || file_put_contents($path, $content, LOCK_EX) === false) {
                    throw new RuntimeException('Falha ao restaurar arquivo.');
                }
            }
        }
        // A API Apache usa www-data (33); os arquivos restaurados devem permanecer graváveis.
        foreach (array_reverse($entries) as $entry) {
            $path = checkedPath($entry['path']);
            if (
                !chmod($path, $entry['type'] === 'directory' ? 0750 : 0640) ||
                !chgrp($path, 33) ||
                !chown($path, 33)
            ) {
                throw new RuntimeException('Falha ao definir proprietário do armazenamento.');
            }
        }
        if (!chmod(ROOT, 0750) || !chgrp(ROOT, 33) || !chown(ROOT, 33)) {
            throw new RuntimeException('Falha ao definir proprietário do volume.');
        }
        echo "Armazenamento restaurado.\n";
    } else {
        throw new RuntimeException('Operação de armazenamento inválida.');
    }
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . "\n");
    exit(1);
}
