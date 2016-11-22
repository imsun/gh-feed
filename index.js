const app = require('koa')()
const router = require('koa-router')()

const request = require('co-request')
const RSS = require('rss')
const htmlparser = require('htmlparser')

const HOST_URL = 'https://github.com'

function get(key, value) {
	if (value === undefined) {
		if (this.children) {
			return domWrapper(this.children[key])
		} else {
			return domWrapper(this[key])
		}
	} else {
		key = typeof key === 'string' ? [key] : key
		for (let i = 0, len = this.children.length; i < len; i++) {
			try {
				const realValue = key.reduce((prev, current) => prev[current], this.children[i])
				if (realValue === value) {
					return domWrapper(this.children[i])
				}
			} catch(e) {}
		}
	}
}

function getAll(key, value) {
	key = typeof key === 'string' ? [key] : key
	const result = domWrapper([])
	this.children.forEach(child => {
		try {
			const realValue = key.reduce((prev, current) => prev[current], child)
			if (realValue === value) {
				result.push(domWrapper(child))
			}
		} catch(e) {}
	})
	return result
}

function domWrapper(dom) {
	dom.get = get.bind(dom)
	dom.getAll = getAll.bind(dom)
	return dom
}

router
	.get('/', function *() {
		this.body = 'test'
	})
	.get('/:owner/:repo', function *() {
		const { owner, repo } = this.params
		const src = `${HOST_URL}/${owner}/${repo}/issues`

		const feed = new RSS({
			title: `${owner}/${repo}`,
			generator: 'gh-feed',
			feed_url: this.url,
			site_url: src,
			ttl: 60
		})

		const res = yield request(src)
		const handler = new htmlparser.DefaultHandler((error, dom) => {
			if (error) {
				console.log(error)
			}
		})
		const parser = new htmlparser.Parser(handler)
		parser.parseComplete(res.body)
		const dom = handler.dom

		// for better performance
		domWrapper(dom)
			.get(3) // html
			.get(3) // body
			.get(['attribs', 'role'], 'main') // main
			.get(1)
			.get(1) // js-repo-pjax-container
			.get(3) // container
			.get(1) // repository-content
			.get(1) // issues-listing
			.get(5)
			.get(1) // ul
			.getAll('name', 'li')
			.forEach(li => {
				const content = li.get(1)
				const main = content.get(['attribs', 'class'], 'float-left col-9 p-2 lh-condensed')
				const title = main.get('name', 'a').children[0].data.trim()
				const url = HOST_URL + main.get('name', 'a').attribs.href
				const labels = main.get(['attribs', 'class'], 'labels')
				const categories = labels === undefined
					? []
					: labels.getAll('name', 'a').map(label => label.children[0].data.trim())
				const meta = main.get(['attribs', 'class'], 'mt-1 text-small text-gray').get(1)
				const date = meta.get('name', 'relative-time').attribs.datetime
				const author = meta.get('name', 'a').children[0].data.trim()
				feed.item({ title, url, categories, date, author })
			})
		this.body = feed.xml()
	})

app.use(router.routes())

app.listen(process.env.PORT || 3000)