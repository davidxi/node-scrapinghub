import Promise from 'bluebird';

import APIError from './APIError';
import Job from './Job';
import RequestProxyMixin from './RequestProxyMixin';

export default class JobSet extends RequestProxyMixin {

  constructor(project, params) {
    super(project, params);

    this.project = project
    this.params = params
    // jobs one-shot iterator
    this._jobs = undefined;
  }

  toString() {
    return `JobSet(${this.project}, ${JSON.stringify(this.params)})`;
  }

  all() {
    return Promise.resolve(
      this._load_jobs()
        .then(jobs => {
          return Promise.map(jobs, json => {
            return new Job(this.project, json['id'], json);
          });
        })
    );
  }

  count() {
    // Returns total results count of current filters.
    // Does not inclue `count` neither `offset`.
    return Promise.resolve(
      this._get('jobs_count', 'json')
        .then(json => {
          return json['total'];
        })
    );
  }

  update(modifiers) {
    let params = Object.assign({}, this.params, modifiers);
    return Promise.resolve(
      this._post('jobs_update', 'json', params)
        .then(json => {
          return json['count'];
        })
    );
  }

  stop() {
    return Promise.map(this, job => {
      return job.stop();
    });
  }

  delete() {
    return Promise.map(this, job => {
      return job.delete();
    });
  }

  _load_jobs() {
    // only load once
    if (this._jobs) {
      return Promise.resolve(this._jobs);
    }

    return Promise.resolve(
      this._get('jobs_list', 'jl', this.params)
        .then(generator => {
          let status_line = '';
          let result = generator();
          try {
            status_line = result.next().value;
          } catch (e) {
            return Promise.reject(
              APIError({title: 'JSON response does not contain status'})
            );
          }

          // jl status expected is only "ok"
          let status = status_line['status'];
          if (status !== 'ok') {
            return Promise.reject(
              APIError({title: `Unknown response status: ${status}`})
            );
          }

          this._jobs = [];
          let item = result.next();
          while (!item.done) {
            this._jobs.push(item.value);
            item = result.next()
          }

          return this._jobs;
        })
    );
  }


  _request_proxy() {
    return this.project._request_proxy();
  }

  _add_params(params) {
    // default to JobSet's params
    // update with user params
    let params2 = Object.assign({}, this.project._add_params(), this.params, params);
    return params2
  }
}