<template>
    <section>
      <div class="container">
         <div class="columns">
            <div class="column">
               <b-field label="Select From Date">
                   <b-datepicker
                       v-model="fromDate"
                       placeholder="From Date..."
                       icon="calendar-today"
                       trap-focus>
                   </b-datepicker>
               </b-field>
            </div>
            <div class="column">
               <b-field label="Select To date">
                   <b-datepicker
                       v-model="toDate"
                       placeholder="To Date..."
                       icon="calendar-today"
                       trap-focus>
                   </b-datepicker>
               </b-field>
            </div>
         </div>
      </div>
      <div class="container pt-4">
         <b-field label="Database name">
            <b-input v-model="databaseName"></b-input>
         </b-field>
         <b-field label="Device Limit">
            <b-input v-model="deviceLimit"></b-input>
         </b-field>
         <b-field label="How many loops">
            <b-input v-model="loops"
               type="number"
               min="1"
               max="12">
            </b-input>
         </b-field>
      </div>
      <div class="container pt-4">
         <b-button type="is-info" @click="getGeotabDevice" expanded>Get Data</b-button>
         <div class=pt-4>
            <JsonCSV :data="reportData" v-if="csvReady" :labels ="labels"> 
               <b-button type="is-success" expanded>Download Data</b-button>
            </JsonCSV>
         </div>
         <div class="pt-4">
            <b-progress type="is-info" v-if="loading" :value="progress" size="is-large" show-value>
                {{status}}
            </b-progress>
            <b-loading :is-full-page="false" v-model="loading" :can-cancel="false"></b-loading>
         </div>
      </div>
      <div class="container pt-4">
         <b-notification auto-close type="is-success" position="is-top" v-model="success" has-icon aria-close-label="Close notification">
           <h2>Got data succesfully</h2>
         </b-notification>
         <b-notification type="is-danger" position="is-top" v-model="error" has-icon aria-close-label="Close notification">
           <h2>Error: {{errorCode}}</h2>
         </b-notification>
      </div>
    </section>

</template>

<script>
   const GeotabApi = require('mg-api-node');
   const api = new GeotabApi("mirandao@rushenterprises.com", "105Norma105!", "rush");
   const axios = require("axios");
   const ref = "https://myadminapi.geotab.com/v2/MyAdminApi.ashx";
   const refGeotab = "https://my967.geotab.com/apiv1";
   const Promise = require('promise');
   import JsonCSV from 'vue-json-csv';
   import moment from 'moment';
   

   export default {
      name: "Main",
      components: {
           JsonCSV,
       },
      methods: {
         pivot(arr) {
         var mp = new Map();
             
         function setValue(a, path, val) {
         if (Object(val) !== val) {
           var pathStr = path.join('.');
           var i = (mp.has(pathStr) ? mp : mp.set(pathStr, mp.size)).get(pathStr);
           a[i] = val;
         } else {
           for (var key in val) {
               setValue(a, key == '0' ? path : path.concat(key), val[key]);
           }
         }
         return a;
         }
             
         var result = arr.map( obj => setValue([], [], obj) );
         return [[...mp.keys()], ...result];
         },
         
         toCsv(arr) {
           return arr.map( row => 
               row.map ( val => isNaN(val) ? JSON.stringify(val) : +val ).join(',')
           ).join('\n');
         },
         
         chunkArray(myArray, chunk_size){
            var index = 0;
            var arrayLength = myArray.length;
            var tempArray = [];
                
            for (index = 0; index < arrayLength; index += chunk_size) {
             var myChunk = myArray.slice(index, index+chunk_size);
             tempArray.push(myChunk);
            }

            return tempArray;
            },
      
         getOwnDatabase () {
            this.loading = true
            this.status = "Getting own database..."
            this.progress += this.parts
            axios.post(ref, {
                 method: 'GetOwnDatabases',
                 params: {
                    "apiKey": this.apiKey,
                    "sessionId": this.sessionId
                 }
              })
                 .then(response => {
                 this.databases = response.data.result
                 console.log("Own Database: ", this.databases)
                 this.getCurrentDeviceDatabases()
                 this.loading = true;
              })
                 .catch(error => {
                 console.log(error);
                 this.loading = false
                 this.error = true
                 this.success = false
                 this.errorCode = error
              });
         },

         getCurrentDeviceDatabases () {
            this.loading = true
            this.status = "Getting current device databases..."
            this.progress += this.parts
            axios.post(ref, {
                 method: 'GetCurrentDeviceDatabases',
                 params: {
                    "apiKey": this.apiKey,
                    "sessionId": this.sessionId,
                    "forAccount": this.account
                 }
              })
                 .then(response => {
                 this.deviceDatabases = response.data.result
                 console.log("Device Databases: ", this.deviceDatabases)
                 //this.getDeviceBillings ()
              })
                 .catch(error => {
                 console.log(error);
                 this.loading = false
                 this.error = true
                 this.success = false
                 this.errorCode = error
              });
         },

         getDeviceBillings () {
             this.status = "Getting current device billings..."
             this.progress += this.parts
             var i;
             var promises = []
             for (i = 1; i < 13; i++) {
               promises.push (
                axios.post(ref, {
                     method: 'GetDeviceContractTransactions',
                     params: {
                        "apiKey": this.apiKey,
                        "sessionId": this.sessionId,
                        "forAccount": this.account,
                        "monthFilter": i,
                        "yearFilter": 2019
                     }
                  })
                     .then(response => {
                     this.deviceBillings.push (response.data.result)
                  })
                     .catch(error => {
                     console.log(error);
                     this.loading = false
                     this.error = true
                     this.success = false
                     this.errorCode = error
                  }))
             }
             Promise.all(promises).then(() => this.getInstallLogs ());
         },

         getInstallLogs () {
            console.log("Device Billings: ", this.deviceBillings)
            this.status = "Getting install logs..."
            this.progress += this.parts
            axios.post(ref, {
                 method: 'GetInstallLogs',
                 params: {
                    "apiKey": this.apiKey,
                    "sessionId": this.sessionId,
                    "fromDate": this.fromDate.toISOString(),
                    "toDate": this.toDate.toISOString()
                 }
              })
                 .then(response => {
                 this.installLogs = response.data.result
                 console.log("Install Logs: ", this.installLogs)
                 this.getDevicePlans ()
              })
                 .catch(error => {
                 console.log(error);
                 this.loading = false
                 this.error = true
                 this.success = false
                 this.errorCode = error
              });
         },

         getDevicePlans () {
            this.status = "Getting device plans..."
            this.progress += this.parts
            axios.post(ref, {
                 method: 'GetDevicePlans',
                 params: {
                    "apiKey": this.apiKey,
                    "sessionId": this.sessionId,
                 }
              })
                 .then(response => {
                 this.devicePlans = response.data.result
                 console.log("Device Plans: ", this.devicePlans)
                 this.getSupportTicket ()
              })
                 .catch(error => {
                 console.log(error);
                 this.loading = false
                 this.error = true
                 this.success = false
                 this.errorCode = error
              });
         },

         getSupportTicket () {
            this.status = "Getting support tickets..."
            this.progress += this.parts
            axios.post(ref, {
                 method: 'GetSupportTickets',
                 params: {
                    "apiKey": this.apiKey,
                    "sessionId": this.sessionId,
                    "fromDate": this.fromDate.toISOString(),
                    "toDate": this.toDate.toISOString(),
                    "userEmail": this.username
                 }
              })
                 .then(response => {
                 console.log("response: ", response)
                 // console.log("Support Tickets: ", this.supportTickets)
                 this.getSupportTicketDetails ()
              })
                 .catch(error => {
                 console.log(error);
                 this.loading = false
                 this.error = true
                 this.success = false
                 this.errorCode = error
              });
         },

         getSupportTicketDetails () {
            this.status = "Getting support tickets..."
            this.progress += this.parts
            var i
            for (i = 0; i < 1; i++) {
               axios.post(ref, {
                    method: 'GetSupportTicketDetails',
                    params: {
                       "apiKey": this.apiKey,
                       "sessionId": this.sessionId,
                       "ticketToken": 622245,
                       "userEmail": this.username
                    }
                 })
                    .then(response => {
                    this.getGeotabGroups ()
                    console.log("Support Tickets Details: ", response)
                 })
                    .catch(error => {
                    console.log(error);
                    this.loading = false
                    this.error = true
                    this.success = false
                    this.errorCode = error
                 });
            }
         },

         getGeotabGroups () {
            this.status = "Getting Geotab groups..."
            this.progress += this.parts
            api.authenticate( (err, data) => {
              api.call('Get', {
                typeName: 'Group',
                search: {
                  name: data.userName
                }
              }, (err, data) => {
                if(err){
                  console.log('Error', err);
                  this.loading = false
                  this.error = true
                  this.success = false
                  this.errorCode = err
                  return;
                }
                this.groups = data
                console.log("Groups: ", data)
                this.getGeotabUsers ()
              });
            });
         },

         getGeotabUsers () {
            this.status = "Getting Geotab users..."
            this.progress += this.parts
            api.authenticate( (err, data) => {
              api.call('Get', {
                typeName: 'User',
                search: {
                  name: data.userName
                }
              }, (err, data) => {
                if(err){
                  console.log('Error', err);
                  this.loading = false
                  this.error = true
                  this.success = false
                  this.errorCode = err
                  return;
                }
                this.users = data
                console.log("Users: ", this.users)
                this.getGeotabDiagnostics ()
              });
            });
         },

         getGeotabDevice () {
            this.status = "Getting Geotab device..."
            this.loading = true
            this.progress += this.parts
            // eslint-disable-next-line no-unused-vars
            api.authenticate( (err, data) => { 
              api.call('Get', {
                typeName: 'Device',
              }, (err, data) => {
                if(err){
                  console.log('Error', err);
                  this.loading = false
                  this.error = true
                  this.success = false
                  this.errorCode = err
                  return;
                }
                this.devices = data
                console.log("Devices: ", this.devices)
                // this.getGeotabDiagnostics ()
                
                var tempArray = this.chunkArray(this.devices, 100)
                
                var self = this
                for (var i = 0; i < tempArray.length; i++ ) {
                   tempArray[i].forEach(function(element) {
                    var obj = {id: element.id}
                    self.devicesId.push(obj)
                    });
                }
                
                
                console.log("devices Id:", this.devicesId)
                this.getReportData()
              });
            });
         },

         getGeotabDiagnostics () {
            this.status = "Getting Geotab diagnostics..."
            this.progress += this.parts
            api.authenticate( (err, data) => {
              api.call('Get', {
                typeName: 'Diagnostic',
                search: {
                  name: data.userName
                }
              }, (err, data) => {
                if(err){
                  console.log('Error', err);
                  this.loading = false
                  this.error = true
                  this.success = false
                  this.errorCode = err
                  return;
                }
                this.diagnostics = data
                console.log("Diagnostics: ", this.diagnostics)
                this.getGeotabRules ()
              });
            });
         },

         getGeotabRules () {
            this.status = "Getting Geotab rules..."
            this.progress += this.parts
            api.authenticate( (err, data) => {
              api.call('Get', {
                typeName: 'Rule',
                search: {
                  name: data.userName
                }
              }, (err, data) => {
                if(err){
                  console.log('Error', err);
                  this.loading = false
                  this.error = true
                  this.success = false
                  this.errorCode = err
                  return;
                }
                this.rules = data
                console.log("Rules: ", this.rules)
                this.getGeotabTrailers ()
              });
            });
         },

         getGeotabTrailers () {
            this.status = "Getting Geotab rules..."
            this.progress += this.parts
            api.authenticate( (err, data) => {
              api.call('Get', {
                typeName: 'Trailer',
                search: {
                  name: data.userName
                }
              }, (err, data) => {
                if(err){
                  console.log('Error', err);
                  this.loading = false
                  this.error = true
                  this.success = false
                  this.errorCode = err
                  return;
                }
                this.trailers = data
                console.log("Trailers: ", data)
                this.success = true
                this.loading = false
              });
            });
         },

        getReportData () {
           var t0 = performance.now()
           this.status = "Getting report data..."
           var difference = moment(this.toDate).diff(moment(this.fromDate), 'months', true)
           difference = Math.floor(difference)
           console.log(difference)
           console.log(moment(this.toDate).add(1,'month').toISOString())
           axios.post(refGeotab, {
                method: 'GetReportData',
                params: {
                   "argument": {
                      "fromUtc": this.fromDate.toISOString(),
                      "toUtc": this.toDate.toISOString(),
                      "reportArgumentType": "RouteComparisonDetailReport",
                      "devices": this.devicesId
                   },
                   "credentials": {
                      "database": this.databaseName,
                      "sessionId": this.sessionIdGeo,
                      "userName": this.username
                   }
                }
             })
                .then(response => {
                this.success = true
                this.loading = false
                console.log(response)
                var converted = this.pivot(response.data.result)
                this.labels = Object.assign({}, converted[0])
                converted.shift()
                this.reportData = converted
                this.csvReady = true
                var t1 = performance.now()
                console.log("Function time: " + (t1 - t0) + " milliseconds.")
             })
                .catch(error => {
                console.log(error);
                this.loading = false
                this.error = true
                this.success = false
                this.errorCode = error
             });
        },


      },

       data() {
           return {
               fromDate: new Date(),
               toDate: new Date(),
               password: "105Norma105!",
               username: "mirandao@rushenterprises.com",
               loading: false,
               success: false,
               error: false,
               errorCode: null,
               data: null,
               apiKey: "",
               sessionId: "",
               databases: [],
               account: "RUSH01",
               deviceDatabases: [],
               status: "",
               progress: 0,
               deviceBillings: [],
               installLogs: [],
               devicePlans: [],
               parts: 100/2,
               supportTickets: [],
               groups: [],
               users: [],
               devices: [],
               diagnostics: [],
               rules: [],
               trailers: [],
               reports: [],
               reportData: [],
               sessionIdGeo: "",
               labels: {},
               csvReady: false,
               devicesId: [],
               deviceLimit: '100',
               databaseName: 'ccswb',
               loops: 1,
           }
       },

       created() {
          axios.post(ref, {
               method: 'Authenticate',
               params: {
                  "username" : this.username,
                  "password" : this.password
               }
            })
               .then(response => {
               this.sessionId = response.data.result.sessionId
               this.apiKey = response.data.result.userId
            })
               .catch(error => {
               console.log(error);
            });

            axios.post(refGeotab, {
                 method: 'Authenticate',
                 params: {
                    "userName" : this.username,
                    "password" : this.password,
                 }
              })
                 .then(response => {
                 this.sessionIdGeo = response.data.result.credentials.sessionId
              })
                 .catch(error => {
                 console.log(error);
              });
       }
   }
</script>


