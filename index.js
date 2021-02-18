require('dotenv').config({path: __dirname + '/.env'});
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const cookieParser = require('cookie-parser');
const dt = require('luxon');
const PDFDocument = require('pdfkit');
const PDFTable = require('voilab-pdf-table')
const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const appRoot = require('app-root-path');
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
	while(firstDueDate.plus({days: i}).plus({days: 15}) < dt.DateTime.local()) { i += 14; }
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

	let pdfDoc = new PDFDocument({
		autoFirstPage: false,
	});

	let table = new PDFTable(pdfDoc, {
		bottomMargin: 30
	});
	table.addColumns([
		{
			id: 'date',
			header: 'Date',
			align: 'left',
			width: 60,
		},
		{
			id: 'instruction',
			header: 'Instruction Hours',
			width: 120,
		},
		{
			id: 'prep',
			header: 'Prep Hours',
			width: 120,
		},
	])
	.onPageAdded(tb => tb.addHeader());

	pdfDoc.addPage();

	let title = `${submitter} Timesheet`
	let subtitle = `Week beginning ${keys[0]}`;
	pdfDoc.fontSize(24);
	pdfDoc.text(title);
	pdfDoc.fontSize(12);
	pdfDoc.text(subtitle);
	pdfDoc.moveDown();

	// pdfDoc.text('Date, Instruction Hours, Prep Hours')
	let rows = _.map(keys, k => {
		return { date: k, instruction: req.body[k][0], prep: req.body[k][1], };
	});
	
	table.addBody(rows);

	pdfDoc.moveDown();

	pdfDoc.text(`Total instruction hours: ${totalInstructionTime}`, 72);
	pdfDoc.text(`Total prep hours: ${totalPrepTime}`);
	pdfDoc.text(`Instruction rate: $${instructionRate}`);
	pdfDoc.text(`Prep rate: $${prepRate}`);
	pdfDoc.text(`Total instruction pay: $${totalInstructionPay}`);
	pdfDoc.text(`Total prep pay: $${totalPrepPay}`);
	pdfDoc.moveDown();
	pdfDoc.text(`Total pay: $${totalPay}`);
	let friendlyDate = keys[0].replace('/', '-').replace('/', '-');
	let file = `${appRoot}/pdfs/${submitter}_Timesheet_${friendlyDate}.pdf`;
	let ws = fs.createWriteStream(file)
	pdfDoc.pipe(ws);

	pdfDoc.end();

	ws.on('finish', () => {
		let filename = path.basename(file);
		res.download(file, filename, err => {
			fs.unlinkSync(file, err => console.error(err));
		});
		// res.send("Timesheet submitted successfully! You are beautiful.")
	});
});

app.listen(PORT);