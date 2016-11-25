const app = require('koa')()
const router = require('koa-router')()

const request = require('co-request')
const RSS = require('rss')
const { DOMParser, XMLSerializer } = require('xmldom')
const parser = new DOMParser({
	errorHandler: {}
})
const serlializer = new XMLSerializer()

const HOST_URL = 'https://github.com'

router
	.get('/:owner/:repo/*', function *() {
		const { owner, repo } = this.params
		const src = `${HOST_URL}/${owner}/${repo}/${this.params[0]}${this.search}`

		const avatarRes = yield request(`${HOST_URL}/${owner}.png`)
		const feed = new RSS({
			title: `${owner}/${repo}`,
			generator: 'gh-feed',
			feed_url: this.url,
			site_url: src,
			image_url: avatarRes.request.uri.href,
			ttl: 60
		})

		const res = yield request(src)
		const doc = parser.parseFromString(res.body, 'text/html')
		const issues = []
		const ul = doc.getElementsByTagName('ul')[1]
		if (ul && ul.getAttribute('class') === 'Box-body js-navigation-container js-active-navigation-container') {
			Array.from(ul.getElementsByTagName('li'))
				.forEach(li => {
					const issue = {}
					Array.from(li.getElementsByTagName('a')).forEach(a => {
						const className = a.getAttribute('class')
						if (/h4/.test(className)) {
							issue.title = a.textContent.trim()
							issue.url = HOST_URL + a.getAttribute('href')
						} else if (/label/.test(className)) {
							issue.categories = issue.categories || []
							issue.categories.push(a.textContent.trim())
						} else if (className === 'tooltipped tooltipped-s muted-link') {
							issue.author = a.textContent.trim()
						}
					})
					issue.date = li.getElementsByTagName('relative-time')[0].getAttribute('datetime')
					issues.push(issue)
				})
		}

		yield issues.map(issue => {
			return function *() {
				const res = yield request(issue.url)
				const body = res.body.replace(/<!-- '"` --><!-- <\/textarea><\/xmp> --><\/option><\/form>/g, '')
				const id = body.match(/id="(issue-.*?)"/)[1]
				const doc = parser.parseFromString(body, 'text/html')
				const contentElement = doc
					.getElementById(id)
					.childNodes[3]
					.childNodes[1]
					.childNodes
				issue.description = serlializer.serializeToString(contentElement)
				feed.item(issue)
			}
		})
		this.set('Content-Type', 'application/rss+xml; charset=utf-8')
		this.body = feed.xml()
	})

app.use(router.routes())

app.listen(process.env.PORT || 3000)