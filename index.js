'use strict';

const _ = require('lodash');
const request = require('request');

const SL_API_URL = 'https://api.softlayer.com/rest/v3';
const SL_SERVICE_PREFIX = 'SoftLayer_';

class SoftLayerClient {
    constructor(username, apiKey) {
        this.credentials = {
            username,
            apiKey,
        };
        this.credentials.basicAuth = `Basic ${new Buffer(`${this.credentials.username}:${this.credentials.apiKey}`).toString('base64')}`;

        this.baseUrl = SL_API_URL;
        this.servicePrefix = SL_SERVICE_PREFIX;

        this.json = true;
    }

    useJson(val) {
        this.json = val;
    }

    request() {
        return new Request(this);
    }
}

class Request {
    constructor(slClient) {
        this.slClient = slClient;

        this.requestOptions = {
            type: 'get',
            json: slClient.json,
            services: [],
            serviceMethod: null,
            mask: null,
            filter: null
        }
    }

    json(val) {
        this.requestOptions.json = val;
        return this;
    }

    get() {
        this.requestOptions.type = 'get';
        return this;
    }

    post() {
        this.requestOptions.type = 'post';
        return this;
    }

    put() {
        this.requestOptions.type = 'put';
        return this;
    }

    delete() {
        this.requestOptions.type = 'delete';
        return this;
    }

    service(service, id) {
        if (service.startsWith(SL_SERVICE_PREFIX)) {
            service = service.substring(SL_SERVICE_PREFIX.length, service.length);
        }

        if (id) {
            this.requestOptions.services.push(`${service}:${id}`);
        } else {
            this.requestOptions.services.push(service);
        }

        return this;
    }

    method(method) {
        if (this.requestOptions.serviceMethod !== null) {
            throw new Error('Only one service method can be defined per SoftLayer request!');
        }

        this.requestOptions.serviceMethod = method;
        return this;
    }

    initializationParameter(id) {
        if (this.requestOptions.services.length === 0) {
            throw new Error('Must define service before attempting to add initialization parameter!');
        }

        const lastIndex = this.requestOptions.services.length - 1;
        const lastService = this.requestOptions.services[lastIndex];

        if (lastService.split(':').length === 2) {
            throw new Error(`Already defined an initialization parameter for service[${lastService}]`);
        }

        this.requestOptions.services = [...this.requestOptions.service.slice(0, lastIndex), `${lastService}:${id}`];
        return this;
    }

    mask(...mask) {
        if (this.requestOptions.mask === null) {
            this.requestOptions.mask = [];
        }

        this.requestOptions.mask = [...mask, ...this.requestOptions.mask];
        return this;
    }

    filter(filter) {
        if (!_.isPlainObject(filter)) {
            throw new Error('Filter argument must be a plain javascript json object!');
        }

        this.requestOptions.filter = filter;
        return this;
    }

    execute(callback) {
        let url = '';

        _.forEach(this.requestOptions.services, (serviceIdCombo) => {
            const split = serviceIdCombo.split(':');
            const service = split[0];
            const id = split.length === 2 ? split[1] : null;

            url += `/${this.slClient.servicePrefix}${service}`;

            if (id !== null) {
                url += `/${id}`;
            }
        });

        if (this.requestOptions.serviceMethod !== null) {
            url += `/${this.requestOptions.serviceMethod}`;
        }

        let queryAdded = false;

        if (this.requestOptions.mask && this.requestOptions.mask.length > 0) {
            queryAdded = true;
            url += '?';
            url += `objectMask=${this.requestOptions.mask.join(';')}`;
        }

        if (this.requestOptions.filter) {
            if (!queryAdded) {
                url += '?';
                queryAdded = true;
            } else {
                url += '&';
            }

            url += `objectFilter=${JSON.stringify(this.requestOptions.filter)}`;
        }

        const headers = {
            authorization: this.slClient.basicAuth
        };

        if (this.requestOptions.json) {
            headers['content-type'] = 'application/json';
            headers['accept'] = 'application/json';
        }

        console.log(url);
        return;

        request({
            method: this.requestOptions.type,
            baseUrl: this.slClient.baseUrl,
            url: url,
            headers: headers
        }, (err, response, body) => {
            if (err) {
                return callback(err, response, body);
            }

            if (!this.requestOptions.json) {
                return callback(err, response, body);
            }

            try {
                return callback(err, response, JSON.parse(body));
            } catch(e) {
                return callback(err, response, body);
            }
        });
    }
}

module.exports = SoftLayerClient;
