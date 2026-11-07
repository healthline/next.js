import Link from 'next/link'
import InRepoLink from '../lib/link'

describe('the next/* aliases under the test runner', () => {
  it('resolve next/link to the in-repo module', () => {
    expect(Link).toBe(InRepoLink)
  })
})
