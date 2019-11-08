import normalizeURL from 'normalize-url'
import { slugifyUrl } from '../../lib/strings.js'
import { query } from './query.js'
import * as filesystem from './index'

// exported
// =

/**
 * @returns {Promise<Object>}
 */
export async function list () {
  var files = (await query({
    path: [
      `/data/unwalled.garden/bookmarks/*.json`,
      `/public/data/unwalled.garden/bookmarks/*.json`
    ]
  }))
  return Promise.all(files.map(readBookmark))
}

/**
 * @param {string} href
 * @returns {Promise<Object>}
 */
export async function get (href) {
  var slug = toSlug(href)
  var file = (await query({
    path: [
      `/data/unwalled.garden/bookmarks/${slug}.json`,
      `/public/data/unwalled.garden/bookmarks/${slug}.json`
    ]
  }))[0]
  if (!file) return null
  return readBookmark(file)  
}

/**
 * @param {Object} bookmark
 * @param {string} bookmark.href
 * @param {string} bookmark.title
 * @param {string} [bookmark.description]
 * @param {boolean} bookmark.isPublic
 * @returns {Promise<string>}
 */
export async function add ({href, title, description, isPublic}) {
  var slug = toSlug(href)
  var path = isPublic ? `/public/data/unwalled.garden/bookmarks/${slug}.json` : `/data/unwalled.garden/bookmarks/${slug}.json`

  await filesystem.get().pda.writeFile(path, JSON.stringify({
    type: 'unwalled.garden/bookmark',
    href,
    title,
    description,
    createdAt: (new Date()).toISOString()
  }, null, 2))

  return path
}

/**
 * @param {string} oldHref
 * @param {Object} bookmark
 * @param {string} [bookmark.href]
 * @param {string} [bookmark.title]
 * @param {string} [bookmark.description]
 * @param {boolean} [bookmark.isPublic]
 * @returns {Promise<string>}
 */
export async function update (oldHref, {href, title, description, isPublic}) {
  // read existing
  var oldBookmark = await get(oldHref)
  if (!oldBookmark) return add({href, title, description, isPublic})

  var slug = toSlug(href || oldBookmark.href)
  var path = isPublic ? `/public/data/unwalled.garden/bookmarks/${slug}.json` : `/data/unwalled.garden/bookmarks/${slug}.json`

  // remove old if changing isPublic
  if (typeof isPublic !== 'undefined' && oldBookmark.isPublic !== isPublic) {
    try {
      let oldSlug = toSlug(oldBookmark.href)
      let oldPath = oldBookmark.isPublic ? `/public/data/unwalled.garden/bookmarks/${oldSlug}.json` : `/data/unwalled.garden/bookmarks/${oldSlug}.json`
      await filesystem.get().pda.unlink(oldPath)
    } catch (e) {
      // ignore
    }
  }

  // write new
  await filesystem.get().pda.writeFile(path, JSON.stringify({
    type: 'unwalled.garden/bookmark',
    href: typeof href === 'string' ? href : oldBookmark.href,
    title: typeof title === 'string' ? title : oldBookmark.title,
    description: typeof description === 'string' ? description : oldBookmark.description,
    createdAt: oldBookmark.createdAt || (new Date()).toISOString(),
    updatedAt: (new Date()).toISOString()
  }, null, 2))

  return path
}

/**
 * @param {string} href
 * @returns {Promise<void>}
 */
export async function remove (href) {
  var oldBookmark = await get(href)
  if (!oldBookmark) return

  let slug = toSlug(oldBookmark.href)
  let path = oldBookmark.isPublic ? `/public/data/unwalled.garden/bookmarks/${slug}.json` : `/data/unwalled.garden/bookmarks/${slug}.json`
  await filesystem.get().pda.unlink(path)
}

// internal
// =

function toSlug (href = '') {
  try {
    href = normalizeURL(href, {
      stripFragment: false,
      stripWWW: false,
      removeQueryParameters: false,
      removeTrailingSlash: true
    })
  } catch (e) {
    // ignore
  }
  return slugifyUrl(href)
}

async function readBookmark (file) {
  var content
  try {
    content = JSON.parse(await filesystem.get().pda.readFile(file.path))
  } catch (e) {
    return null
  }

  content.isPublic = file.path.startsWith('/public')
  return content
}