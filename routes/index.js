module.exports = function(req, res) {
    console.log(`Request received to index at ${new Date().toLocaleTimeString()}`)
    res.status(200).send("Index")
}