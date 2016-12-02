const app = require('koa')()
const router = require('koa-router')()

const request = require('co-request')
const { readFile } = require('co-fs')
const S = require('string')
const marked = require('marked')
const RSS = require('rss')
const { DOMParser, XMLSerializer } = require('xmldom')
const parser = new DOMParser({
	errorHandler: {}
})
const serlializer = new XMLSerializer()

const config = {
	token: ''
}
try {
	Object.assign(config, require('./config'))
} catch (e) {}
if (process.env.GH_TOKEN) {
	Object.assign(config, {
		token: process.env.GH_TOKEN
	})
}

router
	.get('/', function *() {
		const page = yield readFile('./index.html', 'utf8')
		this.set('Content-Type', 'text/html; charset=utf-8')
		this.body = page
	})
	.get('/:owner/:repo/*', genFeed)

app.use(router.routes())

function *genFeed() {
	console.log(`URL: ${this.url}`)
	console.log(`Date: ${(new Date()).toGMTString()}`)
	const host = 'https://api.github.com'
	const headers = {
		'User-Agent': 'request',
		'Accept': 'application/vnd.github.v3+json'
	}
	if (config.token) {
		headers.Authorization = `token ${config.token}`
	}

	const { owner, repo } = this.params
	const filter = {}
	const [, filterKey, filterValue ] = this.params[0].split('/')
	switch (filterKey) {
		case 'created_by':
			filter.creator = filterValue
			break
		case 'assigned':
			filter.assignee = filterValue
			break
	}

	const queryString = this.query.q || ''
	yield S(queryString).parseCSV(':', '"', '\\', ' ') // dirty but effective
		.map(filterInfo => {
			return function *() {
				const [ filterKey, filterValue ] = filterInfo
				switch (filterKey) {
					case 'is':
						if (filterValue === 'open' || filterValue === 'closed' || filterValue === 'all') {
							filter.state = filterValue
						}
						break
					case 'no':
						if (filterValue === 'milestone') {
							filter.milestone = 'none'
						}
						break
					case 'label':
						filter.labels = filter.labels || ''
						filter.labels += filterValue + ','
						break
					case 'sort':
						const [ sortKey, direction ] = filterValue.split('-')
						filter.sort = sortKey
						filter.direction = direction
						break
					case 'author':
						filter.creator = filterValue
						break
					case 'milestone':
						const milestonesRes = yield request({
							headers,
							url: `${host}/repos/${owner}/${repo}/milestones`
						})
						const milestones = JSON.parse(milestonesRes.body)
						for (let i = 0, len = milestones.length; i < len; i++) {
							const milestone = milestones[i]
							if (milestone.title === filterValue) {
								filter.milestone = milestone.number
								break
							}
						}
						break
				}
			}
		})

	const src = `${host}/repos/${owner}/${repo}/issues`
	const userRes = yield request({
		headers,
		url: `${host}/users/${owner}`,
	})
	const feed = new RSS({
		title: `${owner}/${repo}`,
		generator: 'gh-feed',
		feed_url: this.url,
		site_url: src,
		image_url: JSON.parse(userRes.body).avatar_url,
		ttl: 60
	})

	const issuesRes = yield request({
		headers,
		url: src,
		qs: filter
	})

	const rateRemaining = parseInt(issuesRes.headers['x-ratelimit-remaining'])
	console.log(`RateRemaining: ${rateRemaining}`)
	if (rateRemaining <= 0) {
		yield genFeedFromPage.call(this)
		return
	}

	JSON.parse(issuesRes.body)
		.slice(0, 25)
		.forEach(issue => {
			feed.item({
				title: issue.title,
				url: issue.html_url,
				categories: issue.labels.map(label => label.name),
				author: issue.user.login,
				date: issue.created_at,
				description: marked(issue.body)
			})
		})

	this.set('Content-Type', 'application/rss+xml; charset=utf-8')
	this.body = feed.xml()
}

function *genFeedFromPage() {
	const host = 'https://github.com'
	const { owner, repo } = this.params
	const src = `${host}/${owner}/${repo}/${this.params[0]}${this.search}`

	const feed = new RSS({
		title: `${owner}/${repo}`,
		generator: 'gh-feed',
		feed_url: this.url,
		site_url: src,
		image_url: `${host}/${owner}.png`,
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
						issue.url = host + a.getAttribute('href')
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
}

app.listen(process.env.PORT || 3000)