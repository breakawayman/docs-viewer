export type DirectoryHandle = {
  kind: 'directory'
  name: string
  values(): AsyncIterableIterator<DirectoryHandle | { kind: 'file'; name: string; getFile(): Promise<File> }>
  getFileHandle(name: string): Promise<{ getFile(): Promise<File> }>
  queryPermission?(options: { mode: 'read' }): Promise<PermissionState>
  requestPermission?(options: { mode: 'read' }): Promise<PermissionState>
  isSameEntry?(other: DirectoryHandle): Promise<boolean>
}

export type SavedDirectory = {
  id: string
  name: string
  updatedAt: number
  docs: Record<string, string>
  handle?: DirectoryHandle
}

let database: Promise<IDBDatabase> | undefined

function openDatabase() {
  return database ??= new Promise<IDBDatabase>((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('浏览器未启用本地存储，请允许此网站使用 IndexedDB 后重试。'))
      return
    }
    const request = indexedDB.open('docs-viewer-directories', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('directories', { keyPath: 'id' })
    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => { db.close(); database = undefined }
      resolve(db)
    }
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('本地存储正在被其他页面占用，请关闭旧页面后重试。'))
  }).catch((error: unknown) => { database = undefined; throw error })
}

async function transact<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase()
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction('directories', mode)
    const request = action(transaction.objectStore('directories'))
    transaction.oncomplete = () => resolve(request.result)
    transaction.onabort = () => reject(transaction.error ?? request.error ?? new Error('本地目录保存失败。'))
    transaction.onerror = () => reject(transaction.error ?? request.error)
  })
}

export const loadDirectories = () => transact('readonly', (store) => store.getAll()) as Promise<SavedDirectory[]>
export const saveDirectory = (directory: SavedDirectory) => transact('readwrite', (store) => store.put(directory))
export const deleteDirectory = (id: string) => transact('readwrite', (store) => store.delete(id))
