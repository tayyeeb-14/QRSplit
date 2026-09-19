import app from './app.js'
import { connectDatabase } from './config/db.js'

const port = process.env.PORT || 5000
try {
	await connectDatabase()
	app.listen(port, () => console.log(`SplitPay API listening on http://localhost:${port}`))
} catch (error) {
	console.error(`Unable to start SplitPay: ${error.message}`)
	process.exitCode = 1
}