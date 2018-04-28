import { Log } from '../services/logging/log.service';
import {
    ExpressMiddleware,
    Inject,
    InternalServerErrorException,
    Middleware,
    NestMiddleware,
    UnauthorizedException
} from '@nestjs/common';
import { IAuthService } from '../services/authentication/authenticationservice.interface';
import { Appconfig } from '../config/appconfig';
import { IAuthUser } from '../services/authentication/authenticateduser';

@Middleware()
export class HlfcredsgeneratorMiddleware implements NestMiddleware {

    /**
     * Creates an instance of HlfCaMiddleware.
     *
     * This middleware automatically creates HLF user certificates based on the selected authentication provider
     * In this case we Are using the Auth0Service.
     *
     * @memberof HlfCaMiddleware
     * @param authService
     */
    constructor(@Inject('IAuthService') private authService: IAuthService) {
    }

    resolve(...args: any[]): ExpressMiddleware {
        return (req, res, next) => {
            const token = req.headers['authorization'];
            let userId = this.authService.getUserId(token);

            if (!userId && !Appconfig.allowguest) {
                Log.config.debug('UserId not provided and allowguest is marked as false, not allowed to continue');
                throw new UnauthorizedException();
            } else if (!userId) {
                userId = 'guest';
            } else if (userId) {
                req.auth = <IAuthUser>{
                    id: userId
                };
            }

            this.authService.getUserFromStore(userId)
                .then(userFromStore => {
                    // create user creds if not already exists
                    if (!userFromStore) {
                        Log.config.debug('Creating new user:', userId);
                        // token.sub = unchanged user id from auth0
                        this.authService.createUserCreds(userId)
                            .then(() => {
                                next();
                            })
                            .catch(err => {
                                throw new InternalServerErrorException(err);
                            });

                    } else {
                        Log.config.debug('User From store:', userFromStore.getName());

                        next();
                    }
                });
        };
    }
}