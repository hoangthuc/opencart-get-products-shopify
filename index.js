const path = require('path')
const fs = require('fs')
const got = require('got')
const jsdom = require("jsdom")
const axios = require('axios')
const XLSX = require('xlsx')
const writeXlsxFile = require('write-excel-file/node')
const { runInContext } = require('vm')
const { JSDOM } = jsdom
const config = {
    prefix: "YW",
    pathLinks: "yesway/links.json",
    pathSelector: "#Collection > ul.grid.grid--uniform.grid--view-items > li > div > a",
    detailProductUrl: "https://yesway.store/products/",
    pathLinkproducts: "yesway/linkproducts.json",
    pathDataproducts: "yesway/products.json",
    pathImages: "yesway/products/",
    pathDataproductsExcel: "yesway/productsexcel.json",
    pathProductsExcel: "yesway/import_excel.xlsx"
}
const linkproducts = []
const products = []
const productsExcel = []
const addId = (num)=>{
    num = Math.round(num)
    if(num < 10)return "00"+num
    if(num < 100)return "0"+num
    return num
}
const getDataUrl = async (url)=>{
    let res = await got(url)
    return new JSDOM( res.body)   
}
const getLinkProduct = async (dom)=>{
    dom.window.document.querySelectorAll(config.pathSelector).forEach(element => {
        let slug = element.getAttribute('href').split('/')
        linkproducts.push( config.detailProductUrl+slug.at(-1)+'.js'  )
     })
     console.log(linkproducts.length)
     fs.writeFileSync(config.pathLinkproducts, JSON.stringify(linkproducts))
}
const saveProducts = async ()=>{
    const linkproducts = JSON.parse(fs.readFileSync(config.pathLinkproducts))
    let i = 0
    for(link of linkproducts){
        ++i
        let res = await axios.get(link)
        res.data.model = config.prefix + addId(i)
        products.push(res.data)
        console.log(products.length,res.data.model)
        let colors = res.data.options.find(item=>item.name == "Color")
        let sizes = res.data.options.find(item=>item.name == "Size")
        let rowExcel = {
            model: res.data.model,
            name: res.data.title,
            Category: res.data.tags.join(" - "),
            image: "catalog/products/"+res.data.model+"/featured_image.png",
            Color: (colors)?colors.values.join(", "):"",
            size: (sizes)?sizes.values.join(","):"",
            description: res.data.description,
            price: res.data.price/100,
            size_chart: ""
        }
        productsExcel.push(rowExcel)
    }
    fs.writeFileSync(config.pathDataproducts,JSON.stringify(products))
    fs.writeFileSync(config.pathDataproductsExcel,JSON.stringify(productsExcel))
    await saveProductsExcel(productsExcel)
}
const download_image = async (url, image_path) =>{
    try {
        let res = await axios({ url, responseType: 'stream'})
        let dirname = path.dirname(image_path)
        if (!fs.existsSync(dirname))fs.mkdirSync(dirname,{ recursive: true })
        return new Promise((resolve, reject) => {
            res.data
              .pipe(fs.createWriteStream(image_path))
              .on('error', reject)
              .once('close', () => resolve(image_path))
          }) 
    } catch (error) {
        console.log(error)
    }
}
const saveImages = async ()=>{
    const products = JSON.parse(fs.readFileSync(config.pathDataproducts))
    for(product of products){
        await download_image('https:'+product.featured_image, config.pathImages+product.model+'/featured_image.png')
        let colors = product.options.find(item=>item.name == "Color")
        if(colors){
            for(c in colors.values){
                let color = colors.values[c]
                color = color.toLowerCase()
                color = color.replaceAll(" + "," ")
                color = color.replaceAll(" ","-")
                color = config.pathImages+product.model+"/"+color+".png"
                console.log(color)
                await download_image('https:'+product.images[c], color) 
            }
        }
        
    }
}
const saveProductsExcel = async ()=>{
    let data =  JSON.parse(fs.readFileSync( config.pathDataproductsExcel )) 
      const schema = [
        { column: 'model', type: String, value: item=>item.model},
        { column: 'name',  type: String, value: item=>item.name},
        { column: 'Category',  type: String, value: item=>item.Category},
        { column: 'image',  type: String, value: item=>item.image },
        { column: 'Color',  type: String, value: item=>item.Color },
        { column: 'size',  type: String, value: item=>item.size },
        { column: 'description',  type: String, value: item=>item.description },
        { column: 'price',  type: Number,
        format: '#,##0.00', value: item=>item.price },
        { column: 'size_chart',  type: String, value: item=>item.size_chart }
      ]  
    await writeXlsxFile(data, {
        schema, // (optional) column widths, etc.
        filePath: config.pathProductsExcel
    })
}
const run = async ()=>{
    const links = JSON.parse(fs.readFileSync(config.pathLinks))
    for(link of links){
        let dom = await getDataUrl(link)
        getLinkProduct(dom)
    }
    await saveProducts()
    await saveImages() 
    await saveProductsExcel()
    
}
run()
