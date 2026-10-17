// Structured data for search engines and AI assistants (src/lib/structured-data.ts).
// "<" is escaped so a name in the data can never close the script tag.
export default function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />
}
