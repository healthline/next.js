import Link from 'next/link'
import Head, { defaultHead } from 'next/head'

describe('the next/* aliases under the test runner', () => {
  it('resolves next/link to the in-repo Link component', () => {
    expect(typeof Link).toBe('function')
    expect(Link.name).toBe('Link')
  })

  it('resolves next/head to the in-repo Head module with its default head tags', () => {
    expect(typeof Head).toBe('function')
    expect(Array.isArray(defaultHead)).toBe(true)
    expect(defaultHead).toHaveLength(1)
  })
})
