import Promise from 'bluebird';

import JobSet from './JobSet';
import RequestProxyMixin from './RequestProxyMixin';

export default class Project extends RequestProxyMixin {

  constructor(connection, projectid) {
    super(connection, projectid);

    this.connection = connection;
    this.id = projectid;
  }

  toString() {
    return `Project(${this.connection}, ${this.id})`;
  }

  name() {
    return this.id;
  }

  schedule(spider, params) {
    params['spider'] = spider;
    result = this._post('schedule', 'json', params);
    return result['jobid'];
  }

  jobs(params) {
    return Promise.resolve(
      new JobSet(this, params)
    );
  }

  job(id) {
    let jobs = this.jobs({job: id, count: 1});
    return jobs;
  }

  spiders(params) {
    return Promise.resolve(
      this._get('spiders', 'json', params)
        .then(json => {
          return json['spiders'];
        })
    );
  }

  _request_proxy() {
    return this.connection;
  }

  _add_params(params) {
    params = params || {};
    // force project param
    params['project'] = this.id;
    return params;
  }

  // autoscraping_project_slybot(self, spiders = (), outputfile = None) {
  //   from shutil
  //   import copyfileobj
  //   params = {}
  //   if spiders:
  //     params['spider'] = spiders
  //   r = self._get('as_project_slybot', 'zip', params, raw = True)
  //   return r
  //   if outputfile is None
  //   else copyfileobj(r, outputfile)
  // }

  // autoscraping_spider_properties(self, spider, start_urls = None) {
  //   params = {
  //     'spider': spider
  //   }
  //   if (start_urls) {
  //     params['start_url'] = start_urls
  //   }
  //   yield self._post('as_spider_properties', 'json', params)
  //   yield self._get('as_spider_properties', 'json', params)
  // }
}