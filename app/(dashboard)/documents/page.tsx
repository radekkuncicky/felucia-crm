import DocumentsClient from './DocumentsClient'

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dokumenty</h1>
      <DocumentsClient />
    </div>
  )
}
