/**
 * One sample Open Graph card, rendered through the same `ogCard` the shipped
 * routes use.
 *
 * This exists so `/og-preview` can show every step of `titleFontSize` when the
 * seed content only has two posts, both with short titles. It is agentblog.dev
 * furniture and is not part of any registry item, so a consumer never installs
 * it.
 *
 * `dynamicParams = false` means only the indexes `generateStaticParams` returns
 * are routable, so an unknown one 404s before this handler runs. The lookup
 * below still checks, because a route that depends on a config flag for its
 * bounds check is one flag away from reading off the end of the array.
 */
import { ImageResponse } from 'next/og'

import { OG_SAMPLES } from '../../samples'

import { OG_SIZE, ogCard } from '@/lib/og-card'
import { config } from '@/lib/config'

export const dynamicParams = false

export function generateStaticParams(): { index: string }[] {
  return OG_SAMPLES.map((_, index) => ({ index: String(index) }))
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ index: string }> },
): Promise<Response> {
  const { index } = await params
  const sample = OG_SAMPLES[Number(index)]
  if (sample === undefined) return new Response('No such sample', { status: 404 })

  return new ImageResponse(ogCard({ eyebrow: `${config.brand.name} Blog`, title: sample.title }), {
    ...OG_SIZE,
  })
}
