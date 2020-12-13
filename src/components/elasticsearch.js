var elasticsearch = require('elasticsearch');

var elasticClient = new elasticsearch.Client({  
    host: 'localhost:9200',
    log: 'info'
});

function addDoc (myIndex, myContent) {
    console.log("Entered")
    return elasticClient.search({
        index: myIndex,
        body: myContent
      }).then(function (resp) {
          var hits = resp.hits.hits;
          return hits;
      }, function (err) {
          console.log("Error in bullshit")
        console.trace(err.message);
    });
}
  

export default { addDoc }