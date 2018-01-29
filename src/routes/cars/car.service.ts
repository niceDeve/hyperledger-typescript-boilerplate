
import { Component, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import * as Yup from 'yup';
import { ChainMethod } from '../chainmethods.enum';
import { CarDto } from './car.model';
import { InvokeResult } from '../invokeresult.model';
import { RequestHelper } from '../../services/chain/requesthelper';

@Component()
export class CarService {

/**
 * Creates an instance of CarService.
 * @param {RequestHelper} requestHelper 
 * @memberof CarService
 */
constructor(
        private requestHelper: RequestHelper) { }

    /**
     * get all cars
     * 
     * @param {string} userId 
     * @returns {Promise<CarDto[]>} 
     * @memberof AssetsService
     */
    getAll(userId: string): Promise<CarDto[]> {
        // this is a query, query chaincode directly
        return this.requestHelper.queryRequest(ChainMethod.queryAllCars, [], userId)
            .then(result => {
                return result;
            })
            .catch(error => {
                throw new InternalServerErrorException(`Query Failed`);
            });
    }

    /**
     * create new car
     * 
     * @param {CarDto} carDto 
     * @param {string} userId 
     * @returns {Promise<InvokeResult>} 
     * @memberof AssetsService
     */
    create(carDto: CarDto, userId: string): Promise<InvokeResult> {
        const schema = Yup.object().shape({
            Key: Yup.string().required(),
            Make: Yup.string().required(),
            Model: Yup.string().required(),
            Colour: Yup.string().required(),
            Owner: Yup.string().required()
        });

        // this is an invoke, push transaction onto awssqs here
        return this.requestHelper.validateRequest(schema, carDto)
            .then(params => {
                return this.requestHelper.invokeRequest(ChainMethod.createCar, [params], userId)
                    .then(result => {
                        return result;
                    })
                    .catch(error => {
                        throw new InternalServerErrorException(`Failed to add to AWS queue`);
                    });
            })
            .catch(error => {
                throw new BadRequestException(`Invalid DTO`);
            });
    }
}
