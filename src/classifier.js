const riskLabels = { safe: '通常可清理', caution: '确认后再删', danger: '不建议删除' };
const hasAny = (text, terms) => terms.some((term) => text.includes(term));
const extension = (name) => { const index = name.lastIndexOf('.'); return index > 0 ? name.slice(index).toLowerCase() : ''; };

export function appForPath(filePath) {
  const lower = filePath.toLowerCase();
  const bundle = filePath.match(/(?:^|\/)([^/]+)\.app(?:\/|$)/i);
  if (bundle) return bundle[1];
  const known = [
    [['qqmusic', 'irrcache'], 'QQ 音乐'], [['wechat', 'weixin', 'xwechat'], '微信'],
    [['wxwork', 'wecom'], '企业微信'], [['dingtalk'], '钉钉'], [['kimi', 'moonshot'], 'Kimi'],
    [['doubao'], '豆包'], [['openai', 'chatgpt'], 'ChatGPT'], [['claude'], 'Claude'],
    [['cursor'], 'Cursor'], [['workbuddy'], 'WorkBuddy'], [['ollama'], 'Ollama'],
    [['huggingface'], 'Hugging Face'], [['xunlei', 'thunder'], '迅雷'],
    [['baidunetdisk'], '百度网盘'], [['chrome', 'chromium'], 'Chrome'], [['microsoft.edge', '/edge/'], 'Edge'],
    [['firefox'], 'Firefox'], [['adobe'], 'Adobe'], [['xcode'], 'Xcode'],
    [['评估工作台'], '评估工作台'], [['项目工作台'], '项目工作台'],
    [['奖项物料工作台'], '奖项物料工作台'], [['市价调研工作台'], '市价调研工作台']
  ];
  const match = known.find(([terms]) => hasAny(lower, terms));
  if (match) return match[1];
  if (['Desktop', 'Documents', 'Downloads', 'Movies', 'Music', 'Pictures'].includes(filePath.split('/')[0])) return '个人文件';
  return '未识别';
}

export function isAiRelated(filePath) {
  return hasAny(filePath.toLowerCase(), ['kimi', 'moonshot', 'daimon', 'openai', 'chatgpt', 'doubao', 'claude', 'cursor', 'workbuddy', 'ollama', 'huggingface', 'copilot', 'trae', 'windsurf', '.codex', 'safetensors', '.gguf']);
}

export function categoryFor(filePath) {
  const ext = extension(filePath);
  if (['.mov', '.mp4', '.mkv', '.avi', '.m4v', '.webm'].includes(ext)) return '视频';
  if (['.wav', '.aif', '.aiff', '.flac', '.mp3', '.m4a', '.pcm'].includes(ext)) return '音频';
  if (['.dmg', '.iso', '.pkg', '.appimage', '.exe', '.msi'].includes(ext)) return '安装包与镜像';
  if (['.zip', '.rar', '.7z', '.tar', '.gz', '.tgz', '.xz'].includes(ext)) return '压缩包';
  if (['.psd', '.psb', '.tif', '.tiff', '.raw', '.cr2', '.nef', '.arw'].includes(ext)) return '图片与设计';
  if (['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.csv'].includes(ext)) return '文档';
  if (['.db', '.sqlite', '.sqlite3'].includes(ext)) return '数据库';
  if (['.gguf', '.safetensors', '.ckpt', '.pt', '.pth'].includes(ext)) return 'AI 模型';
  return '其他';
}

export function classifyFile(file) {
  const lower = file.path.toLowerCase();
  const ext = extension(lower);
  const app = appForPath(file.path);
  const aiRelated = isAiRelated(file.path);
  const base = { app, aiRelated, category: categoryFor(file.path), typeLabel: '普通文件', risk: 'caution', riskLabel: riskLabels.caution, impact: '无法仅凭名称确认内容，请先打开查看，确认不再需要后再处理。', relation: '' };
  const cache = /(^|\/)(caches?|\.cache|cachestorage|gpucache|code cache|irrcache|deriveddata)(\/|$)/.test(lower);
  if (lower.includes('irrcache')) return { ...base, typeLabel: '歌曲缓存', risk: 'safe', riskLabel: riskLabels.safe, impact: '主要是 QQ 音乐播放缓存，清理后重新播放可能需要联网缓冲，不等于删除独立保存的下载歌曲。' };
  if (cache && hasAny(lower, ['updater', 'shipit', 'update.zip', '/update.'])) return { ...base, typeLabel: '应用更新缓存', risk: 'safe', riskLabel: riskLabels.safe, impact: '通常是下载过的更新包，确认软件更新完成并退出后可清理，需要时可能重新下载。', relation: aiRelated ? '属于 AI 软件更新缓存，不是项目源码。' : '' };
  if (cache) return { ...base, typeLabel: aiRelated ? 'AI 软件缓存' : '应用缓存', risk: 'safe', riskLabel: riskLabels.safe, impact: '通常可以重建，清理后应用下次可能启动较慢或重新加载资源，请先退出对应应用。', relation: aiRelated ? '属于 AI 软件缓存，不是项目源码。' : '' };
  if (/(^|\/)(logs?|temp|tmp)(\/|$)/.test(lower) || lower.includes('.tmp')) return { ...base, typeLabel: '日志或临时文件', risk: 'safe', riskLabel: riskLabels.safe, impact: '通常可清理，但日志会丢失历史诊断记录；请先退出对应应用。' };
  if (/(^|\/)(node_modules|\.venv|venv|site-packages|\.gradle|\.m2)(\/|$)/.test(lower)) return { ...base, typeLabel: '项目依赖', impact: '删除后项目需要重新安装依赖才能运行，源码通常还在。', relation: '与项目运行直接相关，删除可能导致构建或 AI 功能暂时不可用。' };
  if (['.gguf', '.safetensors', '.ckpt', '.pt', '.pth'].includes(ext) || /(^|\/)(models|checkpoints)(\/|$)/.test(lower)) return { ...base, typeLabel: 'AI 模型', impact: '删除后依赖它的 AI 功能或项目无法运行，需要重新下载或恢复。', relation: '与 AI 项目直接相关，可能被多个项目共用。' };
  if (/(^|\/)\.git(\/|$)/.test(lower)) return { ...base, typeLabel: 'Git 历史数据', risk: 'danger', riskLabel: riskLabels.danger, impact: '删除可能丢失提交历史、分支或版本信息。', relation: '与项目完整性直接相关。' };
  if (['.db', '.sqlite', '.sqlite3'].includes(ext) || hasAny(lower, ['.db-wal', '.db-shm', 'leveldb'])) return { ...base, typeLabel: '应用数据库', risk: 'danger', riskLabel: riskLabels.danger, impact: '可能保存聊天记录、设置或应用数据，直接删除可能造成数据丢失或数据库损坏。' };
  if (hasAny(lower, ['/runtime/', '/plugins/', '/frameworks/', '/contents/resources/', '.asar', '.dylib', '.so', '.node'])) return { ...base, typeLabel: '程序运行组件', risk: 'danger', riskLabel: riskLabels.danger, impact: '删除可能导致应用或相关功能无法启动，通常需要重新安装。', relation: aiRelated ? '与 AI 软件运行有关，不是项目源码。' : '' };
  if (['.dmg', '.pkg', '.iso', '.appimage', '.exe', '.msi'].includes(ext)) return { ...base, typeLabel: '安装包或镜像', impact: '删除安装包通常不会卸载已安装的软件，但以后重装需要重新下载。' };
  if (['.zip', '.rar', '.7z', '.tar', '.gz', '.tgz', '.xz'].includes(ext)) return { ...base, typeLabel: '压缩或备份包', impact: '可能包含项目或资料副本，删除不影响已解压内容，但包内独有资料会丢失。' };
  if (['视频', '音频', '图片与设计'].includes(base.category)) return { ...base, typeLabel: '个人媒体或源文件', impact: '可能是唯一内容，建议先播放或打开确认，不要仅按大小决定删除。' };
  if (base.category === '文档') return { ...base, typeLabel: '个人文档或数据表', impact: '可能包含工作资料，删除前建议打开确认。' };
  return base;
}

export function groupForSmallFile(filePath) {
  const lower = filePath.toLowerCase();
  const parts = filePath.split('/');
  if (parts.length === 1) return { path: '', app: appForPath(filePath), kind: 'other' };
  const cacheIndex = parts.findIndex((part) => /^(caches?|\.cache|cachedata|cachestorage|gpucache|code cache|irrcache|deriveddata)$/i.test(part));
  const logIndex = parts.findIndex((part) => /^(logs?|diagnosticreports)$/i.test(part));
  const tempIndex = parts.findIndex((part) => /^(tmp|temp|temporary items)$/i.test(part));
  const dependencyIndex = parts.findIndex((part) => /^(node_modules|\.venv|venv|site-packages|\.gradle|\.m2)$/i.test(part));
  let kind = 'other', root = parts.slice(0, 1);
  if (cacheIndex >= 0) { kind = 'cache'; root = parts.slice(0, Math.min(cacheIndex + (parts[cacheIndex - 1] === 'Library' || parts[cacheIndex] === '.cache' ? 2 : 1), parts.length - 1)); }
  else if (logIndex >= 0) { kind = 'log'; root = parts.slice(0, Math.min(logIndex + (parts[logIndex - 1] === 'Library' ? 2 : 1), parts.length - 1)); }
  else if (tempIndex >= 0) { kind = 'temp'; root = parts.slice(0, tempIndex + 1); }
  else if (dependencyIndex >= 0) { kind = 'dependencies'; root = parts.slice(0, dependencyIndex + 1); }
  else if (parts[0] === 'Library') { kind = 'app-data'; root = parts.slice(0, Math.min(parts[1] === 'Application Support' ? 3 : 2, parts.length - 1)); }
  else if (parts[0] === 'Downloads') { kind = 'downloads'; root = ['Downloads']; }
  else if (['Documents', 'Desktop'].includes(parts[0])) { kind = 'documents'; root = parts.slice(0, Math.min(2, parts.length - 1)); }
  else if (['Movies', 'Music', 'Pictures'].includes(parts[0])) { kind = 'media'; root = parts.slice(0, Math.min(2, parts.length - 1)); }
  else if (hasAny(lower, ['工作台', '/projects/', '/project/', '/repos/', '/code/'])) { kind = 'project'; root = parts.slice(0, 1); }
  return { path: root.join('/'), app: appForPath(filePath), kind };
}

export function classifyGroup(group) {
  const app = appForPath(group.path);
  const aiRelated = isAiRelated(group.path);
  const labels = { cache: '缓存文件夹', log: '日志文件夹', temp: '临时文件夹', dependencies: '项目依赖', models: 'AI 模型', 'app-data': '应用数据', project: '项目文件', documents: '个人文档', downloads: '下载文件', media: '个人媒体', other: '其他文件' };
  const base = { app, aiRelated, typeLabel: labels[group.kind] || '其他文件', risk: 'caution', riskLabel: riskLabels.caution, impact: '这是小文件汇总，不代表整个文件夹都可删除，请先打开确认。', relation: '', canTrash: false };
  if (['cache', 'log', 'temp'].includes(group.kind)) return { ...base, risk: 'safe', riskLabel: riskLabels.safe, canTrash: true, impact: group.kind === 'cache' ? '通常可以重建，清理后应用可能重新加载资源，请先退出对应应用。' : '日志或临时文件通常可清理，请先退出对应应用。', relation: aiRelated ? '属于 AI 软件缓存或临时数据，不是项目源码。' : '' };
  if (group.kind === 'dependencies') return { ...base, impact: '删除后项目需重新安装依赖才能运行，源码通常不受影响。', relation: '与项目运行直接相关。' };
  if (group.kind === 'app-data' || group.kind === 'models') return { ...base, risk: 'danger', riskLabel: riskLabels.danger, impact: '可能包含账号状态、设置、数据库或模型，不建议当缓存删除。', relation: group.kind === 'models' ? '与 AI 项目直接相关。' : '' };
  return base;
}
