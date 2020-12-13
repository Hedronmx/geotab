<template>
  <section>
    <div class="container">
      <div class="columns">
        <div class="column">
          <b-message title="Note" aria-close-label="Close message">
            This software will run from the selected date to today
            automatically.
          </b-message>
          <b-field label="Select From Date">
            <b-datepicker
              v-model="fromDate"
              placeholder="From Date..."
              icon="calendar-today"
              trap-focus
            >
            </b-datepicker>
          </b-field>
        </div>
      </div>
    </div>
    <div class="container pt-4">
      <b-field label="Database name">
        <b-input
          v-model="databaseName"
          placeholder="Enter database name or keep empty to select all"
        ></b-input>
      </b-field>
      <b-field label="Device Limit">
        <b-input v-model="deviceLimit"></b-input>
      </b-field>
    </div>
    <div class="container pt-4">
      <b-button type="is-info" @click="getOwnDatabase" expanded
        >Get Data</b-button
      >
      <div class="pt-4">
        <JsonCSV :data="reportData" v-if="csvReady" :labels="labels">
          <b-button type="is-success" expanded>Download Data</b-button>
        </JsonCSV>
      </div>
      <div class="pt-4">
        <b-progress
          type="is-info"
          v-if="loading"
          :value="progress"
          size="is-large"
          show-value
        >
          {{ status }}
        </b-progress>
        <b-loading
          :is-full-page="false"
          v-model="loading"
          :can-cancel="false"
        ></b-loading>
      </div>
    </div>
    <div class="container pt-4">
      <b-notification
        auto-close
        type="is-success"
        position="is-top"
        v-model="success"
        has-icon
        aria-close-label="Close notification"
      >
        <h2>Got data succesfully</h2>
      </b-notification>
      <b-notification
        type="is-danger"
        position="is-top"
        v-model="error"
        has-icon
        aria-close-label="Close notification"
      >
        <h2>Error: {{ errorCode }}</h2>
      </b-notification>
    </div>
  </section>
</template>

<script>
  const GeotabApi = require("mg-api-node");
  const api = new GeotabApi(
    "mirandao@rushenterprises.com",
    "105Norma105!",
    "rush"
  );
  const axios = require("axios");
  const ref = "https://myadminapi.geotab.com/v2/MyAdminApi.ashx";
  const refGeotab = "https://my967.geotab.com/apiv1";
  const Promise = require("promise");
  import JsonCSV from "vue-json-csv";
  import moment from "moment";
  var elasticsearch = require("elasticsearch");

  var elasticClient = new elasticsearch.Client({
    host: "localhost:9200",
    log: "info",
  });

  export default {
    name: "Main",
    components: {
      JsonCSV,
    },
    methods: {
      addDoc(myIndex, myType, myContent) {
        return elasticClient
          .search({
            index: myIndex,
            type: myType,
            body: myContent,
          })
          .then(
            function(resp) {
              var hits = resp.hits.hits;
              return hits;
            },
            function(err) {
              console.trace(err.message);
            }
          );
      },

      pivot(arr) {
        var mp = new Map();

        function setValue(a, path, val) {
          if (Object(val) !== val) {
            var pathStr = path.join(".");
            var i = (mp.has(pathStr) ? mp : mp.set(pathStr, mp.size)).get(
              pathStr
            );
            a[i] = val;
          } else {
            for (var key in val) {
              setValue(a, key == "0" ? path : path.concat(key), val[key]);
            }
          }
          return a;
        }

        var result = arr.map((obj) => setValue([], [], obj));
        return [[...mp.keys()], ...result];
      },

      toCsv(arr) {
        return arr
          .map((row) =>
            row
              .map((val) => (isNaN(val) ? JSON.stringify(val) : +val))
              .join(",")
          )
          .join("\n");
      },

      chunkArray(myArray) {
        var index = 0;
        var arrayLength = myArray.length;
        var tempArray = [];

        for (
          index = 0;
          index < arrayLength;
          index += parseInt(this.deviceLimit)
        ) {
          var myChunk = myArray.slice(
            index,
            index + parseInt(this.deviceLimit)
          );
          tempArray.push(myChunk);
        }

        return tempArray;
      },

      getMoreDevices(number) {
        this.devicesId = [];
        var self = this;
        this.chunks[number].forEach(function(element) {
          var obj = { id: element.id };
          self.devicesId.push(obj);
        });
      },

      getOwnDatabase() {
        this.loading = true;
        this.status = "Getting own database...";
        this.progress += this.parts;
        axios
          .post(ref, {
            method: "GetOwnDatabases",
            params: {
              apiKey: this.apiKey,
              sessionId: this.sessionId,
            },
          })
          .then((response) => {
            this.databases = response.data.result;
            console.log("Own Database: ", this.databases);
            // this.getCurrentDeviceDatabases();
            this.addDoc("Databases", "Database", this.databases[10]);
            this.loading = true;
          })
          .catch((error) => {
            console.log(error);
            this.loading = false;
            this.error = true;
            this.success = false;
            this.errorCode = error;
          });
      },

      getCurrentDeviceDatabases() {
        this.loading = true;
        this.status = "Getting current device databases...";
        this.progress += this.parts;
        axios
          .post(ref, {
            method: "GetCurrentDeviceDatabases",
            params: {
              apiKey: this.apiKey,
              sessionId: this.sessionId,
              forAccount: this.account,
            },
          })
          .then((response) => {
            this.deviceDatabases = response.data.result;
            console.log("Device Databases: ", this.deviceDatabases);
            //this.getDeviceBillings ()
          })
          .catch((error) => {
            console.log(error);
            this.loading = false;
            this.error = true;
            this.success = false;
            this.errorCode = error;
          });
      },

      getDeviceBillings() {
        this.status = "Getting current device billings...";
        this.progress += this.parts;
        var i;
        var promises = [];
        for (i = 1; i < 13; i++) {
          promises.push(
            axios
              .post(ref, {
                method: "GetDeviceContractTransactions",
                params: {
                  apiKey: this.apiKey,
                  sessionId: this.sessionId,
                  forAccount: this.account,
                  monthFilter: i,
                  yearFilter: 2019,
                },
              })
              .then((response) => {
                this.deviceBillings.push(response.data.result);
              })
              .catch((error) => {
                console.log(error);
                this.loading = false;
                this.error = true;
                this.success = false;
                this.errorCode = error;
              })
          );
        }
        Promise.all(promises).then(() => this.getInstallLogs());
      },

      getInstallLogs() {
        console.log("Device Billings: ", this.deviceBillings);
        this.status = "Getting install logs...";
        this.progress += this.parts;
        axios
          .post(ref, {
            method: "GetInstallLogs",
            params: {
              apiKey: this.apiKey,
              sessionId: this.sessionId,
              fromDate: this.fromDate.toISOString(),
              toDate: this.toDate.toISOString(),
            },
          })
          .then((response) => {
            this.installLogs = response.data.result;
            console.log("Install Logs: ", this.installLogs);
            this.getDevicePlans();
          })
          .catch((error) => {
            console.log(error);
            this.loading = false;
            this.error = true;
            this.success = false;
            this.errorCode = error;
          });
      },

      getDevicePlans() {
        this.status = "Getting device plans...";
        this.progress += this.parts;
        axios
          .post(ref, {
            method: "GetDevicePlans",
            params: {
              apiKey: this.apiKey,
              sessionId: this.sessionId,
            },
          })
          .then((response) => {
            this.devicePlans = response.data.result;
            console.log("Device Plans: ", this.devicePlans);
            this.getSupportTicket();
          })
          .catch((error) => {
            console.log(error);
            this.loading = false;
            this.error = true;
            this.success = false;
            this.errorCode = error;
          });
      },

      getSupportTicket() {
        this.status = "Getting support tickets...";
        this.progress += this.parts;
        axios
          .post(ref, {
            method: "GetSupportTickets",
            params: {
              apiKey: this.apiKey,
              sessionId: this.sessionId,
              fromDate: this.fromDate.toISOString(),
              toDate: this.toDate.toISOString(),
              userEmail: this.username,
            },
          })
          .then((response) => {
            console.log("response: ", response);
            // console.log("Support Tickets: ", this.supportTickets)
            this.getSupportTicketDetails();
          })
          .catch((error) => {
            console.log(error);
            this.loading = false;
            this.error = true;
            this.success = false;
            this.errorCode = error;
          });
      },

      getSupportTicketDetails() {
        this.status = "Getting support tickets...";
        this.progress += this.parts;
        var i;
        for (i = 0; i < 1; i++) {
          axios
            .post(ref, {
              method: "GetSupportTicketDetails",
              params: {
                apiKey: this.apiKey,
                sessionId: this.sessionId,
                ticketToken: 622245,
                userEmail: this.username,
              },
            })
            .then((response) => {
              this.getGeotabGroups();
              console.log("Support Tickets Details: ", response);
            })
            .catch((error) => {
              console.log(error);
              this.loading = false;
              this.error = true;
              this.success = false;
              this.errorCode = error;
            });
        }
      },

      getGeotabGroups() {
        this.status = "Getting Geotab groups...";
        this.progress += this.parts;
        api.authenticate((err, data) => {
          api.call(
            "Get",
            {
              typeName: "Group",
              search: {
                name: data.userName,
              },
            },
            (err, data) => {
              if (err) {
                console.log("Error", err);
                this.loading = false;
                this.error = true;
                this.success = false;
                this.errorCode = err;
                return;
              }
              this.groups = data;
              console.log("Groups: ", data);
              this.getGeotabUsers();
            }
          );
        });
      },

      getGeotabUsers() {
        this.status = "Getting Geotab users...";
        this.progress += this.parts;
        api.authenticate((err, data) => {
          api.call(
            "Get",
            {
              typeName: "User",
              search: {
                name: data.userName,
              },
            },
            (err, data) => {
              if (err) {
                console.log("Error", err);
                this.loading = false;
                this.error = true;
                this.success = false;
                this.errorCode = err;
                return;
              }
              this.users = data;
              console.log("Users: ", this.users);
              this.getGeotabDiagnostics();
            }
          );
        });
      },

      getGeotabDevice() {
        this.status = "Getting Geotab device...";
        this.loading = true;
        this.progress += this.parts;
        // eslint-disable-next-line no-unused-vars
        api.authenticate((err, data) => {
          api.call(
            "Get",
            {
              typeName: "Device",
              resultsLimit: "20",
            },
            (err, data) => {
              if (err) {
                console.log("Error", err);
                this.loading = false;
                this.error = true;
                this.success = false;
                this.errorCode = err;
                return;
              }
              this.devices = data;
              console.log("Devices: ", this.devices);
              // this.getGeotabDiagnostics ()

              this.chunks = this.chunkArray(this.devices);
              this.getReportData();
            }
          );
        });
      },

      getGeotabDiagnostics() {
        this.status = "Getting Geotab diagnostics...";
        this.progress += this.parts;
        api.authenticate((err, data) => {
          api.call(
            "Get",
            {
              typeName: "Diagnostic",
              search: {
                name: data.userName,
              },
            },
            (err, data) => {
              if (err) {
                console.log("Error", err);
                this.loading = false;
                this.error = true;
                this.success = false;
                this.errorCode = err;
                return;
              }
              this.diagnostics = data;
              console.log("Diagnostics: ", this.diagnostics);
              this.getGeotabRules();
            }
          );
        });
      },

      getGeotabRules() {
        this.status = "Getting Geotab rules...";
        this.progress += this.parts;
        api.authenticate((err, data) => {
          api.call(
            "Get",
            {
              typeName: "Rule",
              search: {
                name: data.userName,
              },
            },
            (err, data) => {
              if (err) {
                console.log("Error", err);
                this.loading = false;
                this.error = true;
                this.success = false;
                this.errorCode = err;
                return;
              }
              this.rules = data;
              console.log("Rules: ", this.rules);
              this.getGeotabTrailers();
            }
          );
        });
      },

      getGeotabTrailers() {
        this.status = "Getting Geotab rules...";
        this.progress += this.parts;
        api.authenticate((err, data) => {
          api.call(
            "Get",
            {
              typeName: "Trailer",
              search: {
                name: data.userName,
              },
            },
            (err, data) => {
              if (err) {
                console.log("Error", err);
                this.loading = false;
                this.error = true;
                this.success = false;
                this.errorCode = err;
                return;
              }
              this.trailers = data;
              console.log("Trailers: ", data);
              this.success = true;
              this.loading = false;
            }
          );
        });
      },

      getReportData() {
        this.status = "Getting report data...";
        this.loopReportData();
      },

      async loopReportData() {
        var difference = moment(this.toDate).diff(
          moment(this.fromDate),
          "months",
          true
        );
        difference = Math.floor(difference);
        for (var counter = 0; counter < this.chunks.length; counter++) {
          this.getMoreDevices(counter);
          for (var counterTwo = 1; counterTwo <= difference; counterTwo++) {
            // eslint-disable-next-line no-unused-vars
            let promise = await axios
              .post(refGeotab, {
                method: "GetReportData",
                params: {
                  argument: {
                    fromUtc: this.fromDate.toISOString(),
                    toUtc: moment(this.fromDate)
                      .add(counterTwo, "month")
                      .toISOString(),
                    reportArgumentType: "RouteComparisonDetailReport",
                    devices: this.devicesId,
                  },
                  credentials: {
                    database: this.databaseName,
                    sessionId: this.sessionIdGeo,
                    userName: this.username,
                  },
                },
              })
              .then((response) => {
                var converted = this.pivot(response.data.result);
                if (converted.length > 1) {
                  this.labels = Object.assign({}, converted[0]);
                  converted.shift();
                  this.reportData.push(JSON.parse(JSON.stringify(converted)));
                  console.log(response);
                }
              })
              .catch((error) => {
                console.log(error);
                this.loading = false;
                this.error = true;
                this.success = false;
                this.errorCode = error;
              });
          }
        }
        console.log("Report Datas: ", this.reportData);
        console.log("Labels: ", this.labels);
        this.csvReady = true;
        this.success = true;
        this.loading = false;
      },

      getDeviceStatusInfo() {
        this.status = "Getting device status info...";
        this.progress += this.parts;
        // eslint-disable-next-line no-unused-vars
        api.authenticate((err, data) => {
          api.call(
            "Get",
            {
              typeName: "DeviceStatusInfo",
              search: {
                deviceSearch: { id: this.devicesId[0] },
                fromDate: this.fromDate.toISOString(),
                toDate: this.toDate.toISOString(),
              },
            },
            (err, data) => {
              if (err) {
                console.log("Error", err);
                this.loading = false;
                this.error = true;
                this.success = false;
                this.errorCode = err;
                return;
              }
              this.deviceStatusInfo = data;
              console.log("DeviceStatusInfo: ", data);
              this.success = true;
              this.loading = false;
            }
          );
        });
      },

      getTrailerAttachment() {
        this.status = "Getting trailer attachment...";
        this.progress += this.parts;
        // eslint-disable-next-line no-unused-vars
        api.authenticate((err, data) => {
          api.call(
            "Get",
            {
              typeName: "TrailerAttachmentPermalink",
              search: {
                deviceSearch: { id: this.devicesId[0] },
                fromDate: this.fromDate.toISOString(),
                toDate: this.toDate.toISOString(),
              },
            },
            (err, data) => {
              if (err) {
                console.log("Error", err);
                this.loading = false;
                this.error = true;
                this.success = false;
                this.errorCode = err;
                return;
              }
              this.trailerAttachments = data;
              console.log("Trailer Attachments: ", data);
              this.success = true;
              this.loading = false;
            }
          );
        });
      },

      getDVIRLog() {
        this.status = "Getting DVIR Log...";
        this.progress += this.parts;
        // eslint-disable-next-line no-unused-vars
        api.authenticate((err, data) => {
          api.call(
            "Get",
            {
              typeName: "DVIRLogPermalink",
              search: {
                deviceSearch: { id: this.devicesId[0] },
                defects: {},
                defectRemark: "",
                defectSeverity: "",
                fromDate: this.fromDate.toISOString(),
                toDate: this.toDate.toISOString(),
              },
            },
            (err, data) => {
              if (err) {
                console.log("Error", err);
                this.loading = false;
                this.error = true;
                this.success = false;
                this.errorCode = err;
                return;
              }
              this.dvirlog = data;
              console.log("DVIR Log: ", data);
              this.success = true;
              this.loading = false;
            }
          );
        });
      },
      getFuelTaxDetail() {
        this.status = "Getting tax details...";
        this.progress += this.parts;
        // eslint-disable-next-line no-unused-vars
        api.authenticate((err, data) => {
          api.call(
            "Get",
            {
              typeName: "FuelTaxDetail",
              search: {
                deviceSearch: { id: this.devicesId[0] },
                fromDate: this.fromDate.toISOString(),
                toDate: this.toDate.toISOString(),
              },
            },
            (err, data) => {
              if (err) {
                console.log("Error", err);
                this.loading = false;
                this.error = true;
                this.success = false;
                this.errorCode = err;
                return;
              }
              this.fuelTaxDetails = data;
              console.log("Tax Details: ", data);
              this.success = true;
              this.loading = false;
            }
          );
        });
      },
      getLogRecord() {
        this.status = "Getting log record...";
        this.progress += this.parts;
        // eslint-disable-next-line no-unused-vars
        api.authenticate((err, data) => {
          api.call(
            "Get",
            {
              typeName: "LogRecord",
              search: {
                deviceSearch: { id: this.devicesId[0] },
                fromDate: this.fromDate.toISOString(),
                toDate: this.toDate.toISOString(),
              },
            },
            (err, data) => {
              if (err) {
                console.log("Error", err);
                this.loading = false;
                this.error = true;
                this.success = false;
                this.errorCode = err;
                return;
              }
              this.logRecords = data;
              console.log("Log Records: ", data);
              this.success = true;
              this.loading = false;
            }
          );
        });
      },
      getZone() {
        this.status = "Getting Zone...";
        this.progress += this.parts;
        // eslint-disable-next-line no-unused-vars
        api.authenticate((err, data) => {
          api.call(
            "Get",
            {
              typeName: "Zone",
              search: {
                deviceSearch: { id: this.devicesId[0] },
                fromDate: this.fromDate.toISOString(),
                toDate: this.toDate.toISOString(),
              },
            },
            (err, data) => {
              if (err) {
                console.log("Error", err);
                this.loading = false;
                this.error = true;
                this.success = false;
                this.errorCode = err;
                return;
              }
              this.zone = data;
              console.log("Zone: ", data);
              this.success = true;
              this.loading = false;
            }
          );
        });
      },
      getRoute() {
        this.status = "Getting Route...";
        this.progress += this.parts;
        // eslint-disable-next-line no-unused-vars
        api.authenticate((err, data) => {
          api.call(
            "Get",
            {
              typeName: "Route",
              search: {
                deviceSearch: { id: this.devicesId[0] },
                fromDate: this.fromDate.toISOString(),
                toDate: this.toDate.toISOString(),
              },
            },
            (err, data) => {
              if (err) {
                console.log("Error", err);
                this.loading = false;
                this.error = true;
                this.success = false;
                this.errorCode = err;
                return;
              }
              this.route = data;
              console.log("Route: ", data);
              this.success = true;
              this.loading = false;
            }
          );
        });
      },
      getAudit() {
        this.status = "Getting Audits...";
        this.progress += this.parts;
        // eslint-disable-next-line no-unused-vars
        api.authenticate((err, data) => {
          api.call(
            "Get",
            {
              typeName: "Audit",
              search: {
                deviceSearch: { id: this.devicesId[0] },
                fromDate: this.fromDate.toISOString(),
                toDate: this.toDate.toISOString(),
              },
            },
            (err, data) => {
              if (err) {
                console.log("Error", err);
                this.loading = false;
                this.error = true;
                this.success = false;
                this.errorCode = err;
                return;
              }
              this.audit = data;
              console.log("Audit: ", data);
              this.success = true;
              this.loading = false;
            }
          );
        });
      },
      getTextMessage() {
        this.status = "Getting text Messages...";
        this.progress += this.parts;
        // eslint-disable-next-line no-unused-vars
        api.authenticate((err, data) => {
          api.call(
            "Get",
            {
              typeName: "TextMessage",
              search: {
                deviceSearch: { id: this.devicesId[0] },
                fromDate: this.fromDate.toISOString(),
                toDate: this.toDate.toISOString(),
              },
            },
            (err, data) => {
              if (err) {
                console.log("Error", err);
                this.loading = false;
                this.error = true;
                this.success = false;
                this.errorCode = err;
                return;
              }
              this.textMessages = data;
              console.log("Text Messages: ", data);
              this.success = true;
              this.loading = false;
            }
          );
        });
      },
      getShipmentLog() {
        this.status = "Getting Shipment Logs...";
        this.progress += this.parts;
        // eslint-disable-next-line no-unused-vars
        api.authenticate((err, data) => {
          api.call(
            "Get",
            {
              typeName: "ShipmentLog",
              search: {
                deviceSearch: { id: this.devicesId[0] },
                fromDate: this.fromDate.toISOString(),
                toDate: this.toDate.toISOString(),
              },
            },
            (err, data) => {
              if (err) {
                console.log("Error", err);
                this.loading = false;
                this.error = true;
                this.success = false;
                this.errorCode = err;
                return;
              }
              this.shipmentLogs = data;
              console.log("Shipment Log: ", data);
              this.success = true;
              this.loading = false;
            }
          );
        });
      },
      getDriverRegulation() {
        this.status = "Getting Driver Regulation...";
        this.progress += this.parts;
        // eslint-disable-next-line no-unused-vars
        api.authenticate((err, data) => {
          api.call(
            "Get",
            {
              typeName: "DriverRegulation",
              search: {
                userSearch: { id: this.users[0].id },
                fromDate: this.fromDate.toISOString(),
                toDate: this.toDate.toISOString(),
              },
            },
            (err, data) => {
              if (err) {
                console.log("Error", err);
                this.loading = false;
                this.error = true;
                this.success = false;
                this.errorCode = err;
                return;
              }
              this.driverRegulation = data;
              console.log("Driver Regulations: ", data);
              this.success = true;
              this.loading = false;
            }
          );
        });
      },
      getDutyStatusLog() {
        this.status = "Getting Duty Status Log...";
        this.progress += this.parts;
        // eslint-disable-next-line no-unused-vars
        api.authenticate((err, data) => {
          api.call(
            "Get",
            {
              typeName: "DutyStatusLog",
              search: {
                userSearch: { id: this.users[0].id },
                deviceSearch: { id: this.devicesId[0] },
                fromDate: this.fromDate.toISOString(),
                toDate: this.toDate.toISOString(),
              },
            },
            (err, data) => {
              if (err) {
                console.log("Error", err);
                this.loading = false;
                this.error = true;
                this.success = false;
                this.errorCode = err;
                return;
              }
              this.dutyStatusLogs = data;
              console.log("Duty Status Logs: ", data);
              this.success = true;
              this.loading = false;
            }
          );
        });
      },
      getExceptionEvent() {
        this.status = "Getting Exception Events...";
        this.progress += this.parts;
        // eslint-disable-next-line no-unused-vars
        api.authenticate((err, data) => {
          api.call(
            "Get",
            {
              typeName: "ExceptionEvent",
              search: {
                deviceSearch: { id: this.devicesId[0] },
                fromDate: this.fromDate.toISOString(),
                toDate: this.toDate.toISOString(),
              },
            },
            (err, data) => {
              if (err) {
                console.log("Error", err);
                this.loading = false;
                this.error = true;
                this.success = false;
                this.errorCode = err;
                return;
              }
              this.dutyStatusLogs = data;
              console.log("Duty Status Logs: ", data);
              this.success = true;
              this.loading = false;
            }
          );
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
        parts: 100 / 2,
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
        deviceLimit: "100",
        databaseName: "ccswb",
        loops: 1,
        chunks: [],
        converted: [],
        trips: [],
        deviceStatusInfo: [],
        dvirlog: [],
        trailerAttachments: [],
        fuelTaxDetails: [],
        logRecords: [],
        zone: [],
        route: [],
        audit: [],
        textMessages: [],
        shipmentLogs: [],
        dutyStatusLogs: [],
        driverRegulation: [],
      };
    },

    created() {
      axios
        .post(ref, {
          method: "Authenticate",
          params: {
            username: this.username,
            password: this.password,
          },
        })
        .then((response) => {
          this.sessionId = response.data.result.sessionId;
          this.apiKey = response.data.result.userId;
        })
        .catch((error) => {
          console.log(error);
        });

      axios
        .post(refGeotab, {
          method: "Authenticate",
          params: {
            userName: this.username,
            password: this.password,
          },
        })
        .then((response) => {
          this.sessionIdGeo = response.data.result.credentials.sessionId;
        })
        .catch((error) => {
          console.log(error);
        });
    },
  };
</script>
