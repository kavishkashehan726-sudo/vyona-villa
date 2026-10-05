import { jsonScript } from '@/lib/site';

export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonScript(data) }} />;
}
