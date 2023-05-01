import yargs from 'yargs/yargs'
import natural from 'natural'
import papa from 'papaparse'
import chalk from 'chalk'
import path from 'path'
import _ from 'lodash'
import fs from 'fs'

const log = console.log
const error = (...args) => log(chalk.red('[ERROR]', ...args))
const success = (...args) => log(chalk.green('[SUCCESS]', ...args))
const warning = (...args) => log(chalk.yellow('[WARNING]', ...args))
const info = (...args) => log(chalk.blue('[INFO]', ...args))

function readFile (path, name) {
  if (!path) {
    error(`path for ${name} not provided!`)
    throw new Error('Path not provided!')
  }
  success(`read file ${name} success`)
  return fs.readFileSync(path)
}

function initNLP () {
  const args = yargs(process.argv).argv
  console.log(args)
  const categoryFile = readFile(`${process.cwd()}/sample.txt`, 'categories')
  const list = readFile(args?.list, 'list')
  const trainData = readFile(args?.trainData, 'trainData')
  const cats = []
  const parsedCategories = JSON.parse(categoryFile)
  const toExport = []
  const classifier = new natural.BayesClassifier()
  const result = []
  if (parsedCategories) {
    const values = Object.entries(parsedCategories)
    values.forEach(([key, value]) => {
        if(key.includes('name')) {
            cats.push(value)
        }
    })
    success('Categories parsed!')
  }

  const parseConfig = {
    header: true, // Treat first row as headers
    dynamicTyping: true, // Convert values to their appropriate types
    skipEmptyLines: true, // Skip empty lines
    transformHeader: header => header.toLowerCase().replace(/\W/g, '_') // Clean up headers
  }

  const parsedTrainData = papa.parse(trainData.toString(), parseConfig).data
  success('parsed training data')
  const parsedList = papa.parse(list.toString(), parseConfig).data
  success('parsed data')
  if (parsedTrainData.length) {
    info('training data')
    parsedTrainData.forEach((data, index) => {
      classifier.addDocument(data.keyword, data.category)
      info(`Added training document ${index + 1}/${parsedTrainData.length}`)
    })
    classifier.train()
  }

  success('model trained!')

  if (parsedList.length) {
    info('starting parsing process ...')
    parsedList.forEach((item, index) => {
        try {
            const classified = classifier.classify(item.keyword)
            toExport.push({ ...item, category: classified })
            success(`parsed item! ${index + 1}/${parsedList.length}`)
        } catch (err) {
            error(`${err.message || err}, ${index + 1}/${parsedList.length}`)
        }
    })
  }

  if(toExport.length) {
    info('sorting by volume (descending) ...')
    toExport.sort((a, b) => b.volume - a.volume)
    success('data sorted!')
    info('writing into filesystem')
    const toWrite = papa.unparse(toExport)
    const exportDirPath = `${process.cwd()}/exports`
    if(!fs.existsSync(exportDirPath)) {
        warning('creating export dir')
        fs.mkdirSync(exportDirPath)
    }
    info('started writing...')
    const filePath = `${exportDirPath}/${new Date().toDateString()}-${new Date().getTime()}-categorized.csv`
    fs.promises.writeFile(filePath, toWrite).then(() => {
        success(`wrote file to ${filePath}!`)
    }).catch(error)
  }
}

function start() {
    try {
        initNLP()
    } catch (er) {
        error(er?.message || er)
    }
}

start()
