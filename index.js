const app = require('koa')()
const router = require('koa-router')()

const request = require('co-request')
const RSS = require('rss')
const { DOMParser } = require('xmldom')
const parser = new DOMParser({
	errorHandler: {}
})

const HOST_URL = 'https://github.com'

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
		const doc = parser.parseFromString(res.body, 'text/html')
		Array.from(doc.getElementsByTagName('ul')[1].getElementsByTagName('li'))
			.forEach(li => {
				const issue = {}
				Array.from(li.getElementsByTagName('a')).forEach(a => {
					const className = a.getAttribute('class')
					if (/h4/.test(className)) {
						issue.title = a.firstChild.data.trim()
						issue.url = a.getAttribute('href')
					} else if (/label/.test(className)) {
						issue.categories = issue.categories || []
						issue.categories.push(a.firstChild.data.trim())
					} else if (className === 'tooltipped tooltipped-s muted-link') {
						issue.author = a.firstChild.data.trim()
					}
				})
				issue.date = li.getElementsByTagName('relative-time')[0].getAttribute('datetime')
				feed.item(issue)
			})

		this.set('Content-Type', 'application/rss+xml; charset=utf-8')
		this.body = feed.xml()
	})

app.use(router.routes())

app.listen(process.env.PORT || 3000)