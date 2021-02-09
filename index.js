require('dotenv').config({path: __dirname + '/.env'});
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const cookieParser = require('cookie-parser');
const dt = require('luxon');
const PDFDocument = require('pdfkit');
const router = express.Router();
const PORT = process.env.PORT;

app.set('view engine', 'pug');
app.set('views','./views');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

const sessionOptions = {
	cookie: { maxAge: 86400000 },
	store: new MemoryStore({
		checkPeriod: 86400000 // prune expired entries every 24h
	}),
	secret: 'keyboard cat',
	resave: false,
	saveUninitialized: true,
	cookie: {},
};

app.use(session(sessionOptions));
app.use('/timesheet', router);

router.get('/', (req, res) => {

	let firstDueDate = dt.DateTime.local(2019, 5, 2);
	let i = 0;
	while(firstDueDate.plus({days: i}).plus({days: 14}) < dt.DateTime.local()) { i += 14; }
	let currentWeekStartDate = firstDueDate.plus({days: i});
	let currentWeek = [];
	for (let j = 0; j < 14; j++) {
		let day = currentWeekStartDate.plus({days: j});
		currentWeek.push({
			weekday: day.weekdayLong,
			date: day.toLocaleString(),
		});
	}

	res.render('index', { days: currentWeek });
});

router.post('/', (req, res) => {
	
	let submitter = req.body.name;
	let instructionRate = req.body.instructionRate;
	let prepRate = req.body.prepRate;
	let keys = _.keys(req.body);
	keys.pop();
	keys.pop();
	keys.pop();

	let totalInstructionTime = 0;
	let totalPrepTime = 0;
	_.forEach(keys, k => {
		totalInstructionTime += Number(req.body[k][0]);
		totalPrepTime += Number(req.body[k][1]);
	});

	let totalInstructionPay = Number(instructionRate) * totalInstructionTime;
	let totalPrepPay = Number(prepRate) * totalPrepTime;
	let totalPay = totalInstructionPay + totalPrepPay;

	let pdfDoc = new PDFDocument;
	pdfDoc.pipe(fs.createWriteStream(`${appRoot}/pdfs/SampleDocument.pdf`));
	pdfDoc.text("My Sample PDF Document");
	pdfDoc.end();

	res.send("Timesheet submitted successfully! You are beautiful.")
});

app.listen(PORT);