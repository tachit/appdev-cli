
var fs = require('fs');
var path = require('path');


var util = null;

var Generator = require('./class_generator.js');

var Resource = new Generator({
    key:'install',
    command:'i install [dir_name]',
    commandHelp: 'install the appdevJS framework under given directory',
    parameters:['dirName', '[options]']
});


module.exports = Resource;


Resource.prepareTemplateData = function () {
    util = this.adg;

    this.templateData = {};
    this.templateData.appName = this.options.dirName || '?notFound?';


    util.debug('templateData:');
    util.debug(this.templateData);


}



Resource.perform = function () {
    util = this.adg;
    var self = this;

    util.log( 'Installing AppdevJS framework ');
    util.debug('install.perform():  params ');
    util.debug(this.params);

    // this command will create a new directory in the current working directory
    this.cwd = process.cwd();
    util.verbose('cwd:'+this.cwd);


    // parse Options
    this.parseOptions();

    util.debug('the provided cmd line options:');
    util.debug(this.options);

    if (this.options.dirName) {


        // if directory ! exist
        if (fs.existsSync(this.options.dirName) )  {

            util.log();
            util.log('<yellow>directory '+this.options.dirName + ' already exists.</yellow>');
            util.log('<yellow>Use this command for new installations only.</yellow>');
            util.log();
            process.exit(1);

        }


        // define the series of methods to call for the setup process
        var setupProcess = [
                        'installSailsApp',
                        'installDBAdaptor',
                        'installLibraries'
        ];


        this.methodStack(setupProcess, function() {

            // when they are all done:


            util.log();
            util.log('Now to run the program :');
            util.log('   > cd '+self.options.dirName);
            util.log('   > sails lift');

            process.chdir('..');
        })

    }  // end if options.dirName


}



Resource.installSailsApp = function (done) {

    var self = this;

    util.log('creating new SailJS application at :'+this.options.dirName);

    var params = [ 'new',  this.options.dirName];

    this.shell('sails', params, [], function(){

        process.chdir( self.options.dirName);
        self.prepareTemplateData();
        self.parseTemplates();

        if (done) done();

    });
}




Resource.installDBAdaptor = function (done) {

    var self = this;

    var qset =  {
        question: 'which db adaptor do you want to use [mysql, sqllite, memory]:',
        data: 'adaptor',
        def : 'mysql',
        post: function(data) { data.adaptor = data.adaptor.toLowerCase(); }

    }
    this.questions(qset, function(err, data) {

        if (err) {
             process.exit(1);
        } else {

            switch (data.adaptor )
            {
                case "mysql" :
                    self.defaults('adapter', 'mysql');
                    self.installMysqlAdaptor(done);
                    break;

                case "sqllite":
                case 'memory':
                    if (done) done();
                    break;

            }
        }


    });
}





Resource.installLibraries = function(done) {
    var self = this;

    var listInstall = [
            // use appdev application [dirName] to setup our application inside the framework
            { cmd:'appdev', params:[ 'application',  this.options.dirName], filter:['Creating'], log:'setting up client directories for '+this.options.dirName },

            // use git clone ssh://....  to pull down our appdev client side library.
//            { cmd:'git', params:[ 'clone',  'ssh://gitolite@git.zteam.biz/appdev_client', path.join('assets', 'appdev')], filter:['Creating'], log:'installing appdev client side library' },
            { cmd:'git', params:[ 'clone',  'https://github.com/appdevdesigns/appdev-client.git', path.join('assets', 'appdev')], filter:['Creating'], log:'installing appdev client side library' },


//// TODO: figure out the best way to package StealJS and CanJS to include in our projects
////  a) git clone ... pulls down way too much, and isn't necessary
////  b) don't want to package the whole thing with appdevgen ... too much bloat!
////  c) does windows support a similar curl url/for/steal  -o steal   ??  how do we support both Mac & Windows?
      // --> provide an appdev download url/for/steal  local/path/to/fileName.js
      //    and call that here:

            // StealJS library : git@github.com:bitovi/steal.git
//           { cmd:'git', params:[ 'clone',  'ssh://git@github.com/bitovi/steal.git', path.join('assets', 'steal')], filter:['Creating'], log:'installing stealjs ... ~10mb ' }
        ];

    var recursiveInstall = function(indx, list, cb) {

        indx = indx || 0;
        if (indx >= list.length) {
            if (cb) cb();
        } else {

            if (list[indx].log) {
                util.log();
                util.log(list[indx].log);
            }
            self.shell(list[indx].cmd, list[indx].params, list[indx].filter, function(){

                recursiveInstall(indx+1, list, cb);
            });

        }
    }


    // start the installations
//// TODO: once the appdev library is hosted on github, we can simply do this:
//    recursiveInstall(0, listInstall, done);
//// until then we need to verify the library was downloaded:

    // start the installations
    recursiveInstall(0, listInstall,function() {


        if (!fs.existsSync(path.join('assets', 'appdev'))) {

            util.error('the appdev library did not install.  Are you calling this with the VPN on?')

            // don't continue on...

        } else {

            if (done) done();

        }
    });
}






//// TODO:  create a patch method that will allow me to add in data to config files:
Resource.installMysqlAdaptor = function (done) {

    var self = this;

    var qset =  {
          question:'connect by socket or port [socket,port]:',
          data: 'connectionType',
          def:  'port',
          post: function(data) { data.connectionType = data.connectionType.toLowerCase(); },
          then:[

                {   cond:function(data) {return data.connectionType == 'port'},
                    question:'host [localhost,http://your.server.com]:',
                    data:'host',
                    def :'localhost'
                },
                {   cond:function(data) {return data.connectionType == 'port'},
                    question:'port:',
                    data:'port',
                    def :'8889'
                },
                {   cond:function(data) {return data.connectionType == 'socket'},
                    question:'socket path :',
                    data:'socketPath',
                    def :''
                },
                {
                    question:'user:',
                    data:'user',
                    def :'root'
                },
                {
                    question:'password:',
                    data:'password',
                    def :'root',
 //                   silent:true,
 //                   replace:'*'
                },
                {
                    question:'database:',
                    data:'database',
                    def :'develop'
                }

          ]
      }


    this.questions(qset, function(err, data) {

        // don't continue if there was an error
        if (err) {

            process.exit(1);

        } else {

            var adPublish = ["$1","      AD.comm.hub.publish('ad.sails.model.update', message);", '', '', "$2"].join('\n');

            //// patch config/local.js to include the local mysql settings
            var patchSet = [ {  file:'config/local.js', tag:"};", template:'__config_db_mysql.ejs', data:data },
                             {  file:'config/adapters.js', tag:"'default': 'disk',", replace:"'default': 'mysql'," },
                             {  file:'config/adapters.js', tag:"myLocalMySQLDatabase", replace:"mysql" },
                             {  file:'assets/js/app.js', tag:/(socket\.on\('message'[\s\S]+?)(\}\);)/, replace:adPublish }
                           ];
            self.patchFile( patchSet, function() {

                // now install the sails-mysql adaptor
                var params = [ 'install',  'sails-mysql', '--save'];
                util.log();
                util.log('installing sails-mysql adaptor');

                self.shell('npm', params, ['Creating'], function(){
                    if (done) done();
                });


//// use this if we need to install directly from git hub:
/*
                var params = ['clone', 'git@github.com:balderdashy/sails-mysql.git', path.join('node_modules', 'sails-mysql')];
                util.log();
                util.log('installing sails-mysql adaptor from GIT ');

                self.shell('git', params, ['Creating'], function(){

                    var sailsPath = path.join('node_modules','sails-mysql');
                    if (!fs.existsSync(sailsPath)) {
                        util.error('sails-mysql not installed.');
                        util.error('Are you sure you are connected to the internet?');
                        process.exit(1);
                    } else {

                        //// now tell NPM to install it's dependencies
                        util.log('NPM installing sails-mysql dependencies ');
                        process.chdir(sailsPath);
                        var npmParams = ['install'];
                        self.shell('npm', npmParams, [], function() {
                            process.chdir(path.join('..', '..'));
                            if (done) done();
                        });

                    }

                });
*/
            });


        }

    });
}