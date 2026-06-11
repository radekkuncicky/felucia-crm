import TemplateForm from '../TemplateForm'

export default async function NewTemplatePage() {
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Nová vzorová nabídka</h1>
      <TemplateForm />
    </div>
  )
}
