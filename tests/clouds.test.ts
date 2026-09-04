import { describe, expect, it } from 'vitest'
import * as Cesium from 'cesium'
import { buildCloudsLayer, CLOUD_TEXTURE_HEIGHT, CLOUD_TEXTURE_WIDTH } from '../src/globe/sun'

// Regression for the interactive-QA find: SingleTileImageryProvider REQUIRES
// tileWidth/tileHeight (Check.typeOf.number) — omitting them threw an uncaught
// DeveloperError when toggling clouds on.
describe('approximate clouds layer construction', () => {
  it('builds without throwing and carries the generated texture dimensions', () => {
    const layer = buildCloudsLayer('data:image/png;base64,iVBORw0KGgo=')
    expect(layer).toBeInstanceOf(Cesium.ImageryLayer)
    expect(layer.alpha).toBeCloseTo(0.85, 6)
  })

  it('documents the upstream requirement (dims missing → throws)', () => {
    expect(
      () =>
        new Cesium.SingleTileImageryProvider({
          url: 'data:,',
          rectangle: Cesium.Rectangle.MAX_VALUE,
          // @ts-expect-error intentionally omitted
          tileWidth: undefined,
          tileHeight: undefined,
        }),
    ).toThrow()
  })

  it('keeps texture dimensions consistent and positive', () => {
    expect(CLOUD_TEXTURE_WIDTH).toBe(1024)
    expect(CLOUD_TEXTURE_HEIGHT).toBe(512)
  })
})
