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
	.get('/issues/:owner/:repo', function *() {
		const { owner, repo } = this.params
		const res = yield request(`${HOST_URL}/${owner}/${repo}/issues`)
		const handler = new htmlparser.DefaultHandler((error, dom) => {
			if (error) {
				console.log(error)
			}
		})
		const parser = new htmlparser.Parser(handler)
		parser.parseComplete(res.body)
		const dom = handler.dom

		// for better performance
		const issues = domWrapper(dom)
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
			.map(li => {
				const content = li.get(1)
				const main = content.get(['attribs', 'class'], 'float-left col-9 p-2 lh-condensed')
				const title = main.get('name', 'a').children[0].data.trim()
				const url = HOST_URL + main.get('name', 'a').attribs.href
				const labels = main.get(['attribs', 'class'], 'labels')
				const tags = labels === undefined
					? []
					: labels.getAll('name', 'a')
					.map(label => ({
						name: label.children[0].data.trim(),
						url: HOST_URL + label.attribs.href
					}))
				return { title, url, tags }
			})
		this.body = JSON.stringify(issues)
	})

app.use(router.routes())

app.listen(3000)