import { classifyFile, classifyGroup, groupForSmallFile } from './classifier.js';

export async function scanDirectory(rootHandle, { threshold = 100 * 1024 * 1024, onProgress = () => {}, shouldCancel = () => false } = {}) {
  const files = [], groups = new Map(), directories = new Map();
  let totalFiles = 0, smallFileCount = 0, smallFileSize = 0, cancelled = false;

  async function walk(directory, relativePath) {
    if (shouldCancel()) { cancelled = true; return; }
    directories.set(relativePath, directory);
    for await (const [name, handle] of directory.handle.entries()) {
      if (shouldCancel()) { cancelled = true; return; }
      const filePath = relativePath ? `${relativePath}/${name}` : name;
      if (handle.kind === 'directory') {
        await walk({ handle, parentHandle: directory.handle, name }, filePath);
      } else {
        const file = await handle.getFile();
        totalFiles++;
        if (totalFiles % 100 === 0) onProgress({ totalFiles, currentPath: filePath });
        const base = { id: `file:${filePath}`, path: filePath, name, size: file.size, modified: new Date(file.lastModified).toISOString(), handle, parentHandle: directory.handle };
        if (file.size >= threshold) files.push({ ...base, ...classifyFile(base) });
        else {
          smallFileCount++; smallFileSize += file.size;
          const descriptor = groupForSmallFile(filePath);
          const key = `${descriptor.kind}|${descriptor.path}`;
          if (!groups.has(key)) groups.set(key, { id: `group:${key}`, path: descriptor.path, name: descriptor.path.split('/').pop() || rootHandle.name, app: descriptor.app, kind: descriptor.kind, count: 0, size: 0, modified: base.modified, sampleNames: [] });
          const group = groups.get(key);
          group.count++; group.size += file.size;
          if (base.modified > group.modified) group.modified = base.modified;
          if (group.sampleNames.length < 3 && !group.sampleNames.includes(name)) group.sampleNames.push(name);
        }
      }
    }
  }

  await walk({ handle: rootHandle, parentHandle: null, name: rootHandle.name }, '');
  const folderGroups = [...groups.values()].map((group) => {
    const directory = directories.get(group.path);
    return { ...group, ...classifyGroup(group), handle: directory?.handle || null, parentHandle: directory?.parentHandle || null };
  });
  files.sort((a, b) => b.size - a.size); folderGroups.sort((a, b) => b.size - a.size);
  return { files, groups: folderGroups, totalFiles, smallFileCount, smallFileSize, cancelled, threshold };
}
