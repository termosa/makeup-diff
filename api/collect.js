import request from 'request'

const day = 1e3 * 60 * 60 * 24
const cache = {}

const matchAGroup = (str, regexp) => (str.match(regexp) || [])[1]

const parseProperties = htmlProps => {
  if (!htmlProps) return {}
  return htmlProps.split(/<br.*?>/).filter(Boolean)
    .reduce((props, prop) => {
      const name = matchAGroup(prop, />\s*(.+?)\s*:?\s*</)
      const value = matchAGroup(prop, /<\/strong>\s*(.+)\s*/)
      if (typeof name === 'undefined' || typeof value === 'undefined')
        return props
      return Object.assign(props, { [name]: value })
    }, {})
}

const loadPage = link => new Promise((resolve, reject) => {
  request(link, (error, response, body) => {
    if (error) reject(error)
    else resolve(body)
  })
})

const loadProduct = async id => {
  if (cache[id] && Date.now() - cache[id].loadedAt < day)
    return { ...cache[id], fromCache: true }

  try {
    const htmlPage = await loadPage(`https://makeup.com.ua/product/${id}/`)
    const product = {
      id,
      imageUri: matchAGroup(htmlPage, /product\-slider__item.+?img.+?src="([^\s]+)"/),
      name: matchAGroup(htmlPage, /product\-item__name.+?>([^<]+)/),
      category: matchAGroup(htmlPage, /product\-item__category.+?>([^<]+)/),
      price: matchAGroup(htmlPage, /product\-item__price.+?>(\d+)/),
      rating: matchAGroup(htmlPage, /ratingValue.+?content="([^"]+)"/),
      reviews: matchAGroup(htmlPage, /reviewCount.+?content="([^"]+)"/),
      properties: parseProperties(matchAGroup(htmlPage, /product\-item__text.+?<div>(.+?)<\/div>/)),
      loadedAt: Date.now()
    }

    cache[id] = product.name ? product : { id, error: 'Cannot parse the page' }
  } catch (error) {
    cahce[id] = { id, error: error.message }
  }
  return cache[id]
}

export default async (req, res) => {
  const productIds = (req.query.products || '').split(',').filter(Boolean)
  const products = await Promise.all(productIds.map(loadProduct))
  res.json(products)
}
