import { Component, Inject } from '@nestjs/common';
import { HlfClient } from './hlfclient';
import { QueuePusherService } from '../queue/queuepusher.service';
import { ChainMethod } from '../../routes/chainmethods.enum';
import { InvokeResult } from '../../routes/invokeresult.model';
import { EnvConfig } from '../../config/env';
import { PusherService } from '../events/implementations/pusher.service';
import { Log } from '../logging/log.service';
import { isObject } from '@nestjs/common/utils/shared.utils';
import { IEventService } from '../events/event.interface';

@Component()
export class RequestHelper {

    // TODO: refactor invokes according to https://docs.nestjs.com/recipes/cqrs

    /**
     * Creates an instance of RequestHelper.
     * @param {HlfClient} hlfClient
     * @param {PusherService} webSocketService
     * @param {QueuePusherService} queuePusherService
     * @memberof RequestHelper
     */
    constructor(private hlfClient: HlfClient,
                @Inject('IEventService') private webSocketService: IEventService,
                private queuePusherService: QueuePusherService) {
    }

    /**
     * Pass transaction request to aws queue
     *
     * @param {ChainMethod} chainMethod
     * @param {string[]} params
     * @param {string} userId
     * @param invokeAlways - Workaround for message deduplication SQS
     * @returns {Promise<InvokeResult>}
     * @memberof RequestHelper
     */
    public invokeRequest(chainMethod: ChainMethod, params: string[], userId: string, invokeAlways = false): Promise<InvokeResult | any> {

        params = this.forceStringParams(params);

        if (EnvConfig.BYPASS_QUEUE) {
            return this.hlfClient.invoke(chainMethod, params)
                .then((response) => {
                    Log.hlf.debug('Invoke successfully executed: ', response);
                    this.webSocketService.triggerSuccess(userId, chainMethod, params);
                    return Promise.resolve({txHash: response});
                })
                .catch(error => {
                    Log.hlf.error(`${chainMethod}`, error);
                    this.webSocketService.triggerError(userId, chainMethod, params);
                    return Promise.reject(error);
                });
        } else {
            return this.queuePusherService.add(chainMethod, params, userId, invokeAlways)
                .then((response) => {
                    Log.awssqs.debug('Invoke successfully added to SQS queue: ', response);
                    return Promise.resolve(response);
                })
                .catch(error => {
                    Log.awssqs.error(`${chainMethod}`, error);
                    return Promise.reject(error);
                });
        }
    }

    /**
     * Query hlf chain and return response
     *
     * @param {ChainMethod} chainMethod
     * @param {string[]} params
     * @returns {Promise<any>}
     * @memberof RequestHelper
     */
    public queryRequest(chainMethod: ChainMethod, params: string[]): Promise<any> {
        params = this.forceStringParams(params);

        return this.hlfClient.query(chainMethod, params)
            .then((response) => {
                Log.hlf.debug('Query successfully executed: ', response);
                return Promise.resolve(response);
            })
            .catch(error => {
                Log.hlf.error(`${chainMethod}`, error);
                return Promise.reject(error);
            });
    }

    /**
     * validate requests with yup
     *
     * @param {Schema} schema
     * @param {any} body
     * @returns {Promise<any>}
     * @memberof RequestHelper
     */
    public validateRequest(schema: Schema, body): Promise<any[]> {
        return schema.validate(body)
            .then(params => {
                Log.config.debug('Valid object schema: ', params);
                return Promise.resolve(params);
            })
            .catch((error) => {
                Log.config.error('Validation', error);
                return Promise.reject(error);
            });
    }

    private forceStringParams(params: string[]): string[] {
        return params.map(param => {
            if (isObject(param)) {
                return JSON.stringify(param);
            }

            return param.toString();
        });
    }

}
