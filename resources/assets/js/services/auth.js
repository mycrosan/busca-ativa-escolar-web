(function() {
	angular
		.module('BuscaAtivaEscolar')
		.service('Auth', function Auth($q, $rootScope, $localStorage, $http, $resource, $state, Modals, API, Identity, Config) {

			var self = this;

			$localStorage.$default({
				session: {
					user_id: null,
					token: null,
					token_expires_at: null,
					refresh_expires_at: null
				}
			});

			function requireLogin(reason) {
				return Modals.show(Modals.Login(reason, false));
			}

			function provideToken() {

				// TODO: refresh with endpoint if first time on page

				// Isn't even logged in
				if(!Identity.isLoggedIn()) return requireLogin('Você precisa fazer login para realizar essa ação!');

				// Check if session is valid
				if(!$localStorage.session.token || !$localStorage.session.user_id) return $q.go('login');

				// Has valid token
				if(!isTokenExpired()) return $q.resolve($localStorage.session.token);

				console.log("[auth::token.provide] Token expired! Refreshing...");

				// Is logged in, but both access and refresh token are expired
				if(isRefreshExpired()) {
					console.log("[auth::token.provide] Refresh token also expired! Logging out...");
					return requireLogin('Sua sessão expirou! Por favor, entre seus dados novamente para continuar.');
				}

				// Is logged in, access token expired but refresh token still valid
				return self.refresh().then(function (session) {
					console.log("[auth::token.provide] Refreshed, new tokens: ", session);
					return session.token;
				});

			}

			function isTokenExpired() {
				var now = (new Date()).getTime();
				return !Identity.isLoggedIn() || (now >= $localStorage.session.token_expires_at);
			}

			function isRefreshExpired() {
				var now = (new Date()).getTime();
				return !Identity.isLoggedIn() || (now >= $localStorage.session.refresh_expires_at);
			}

			function handleAuthResponse(response) {

				if(response.status !== 200) {
					console.log("[auth::login] Rejecting Auth response! Status= ", response.status);
					return $q.reject(response.data);
				}

				$localStorage.session.token = response.data.token;
				$localStorage.session.token_expires_at = (new Date()).getTime() + (Config.TOKEN_EXPIRES_IN * 1000);
				$localStorage.session.refresh_expires_at = (new Date()).getTime() + (Config.REFRESH_EXPIRES_IN * 1000);

				// Auth.refresh doesn't return user/user_id, so we can't always set it
				// TODO: response should let us know if refresh, so we can throw errors when expecting a user but do not receive it
				if(response.data.user) Identity.setCurrentUser(response.data.user);
				if(response.data.user.id) $localStorage.session.user_id = response.data.user.id;

				return $localStorage.session;
			}

			function handleAuthError(response) {

				console.error("[auth::login] API error: ", response);

				if(!response || !response.status || !API.isUseableError(response.status)) {
					console.warn("[auth::login] Error code ", response.status, " not in list of useable errors: ", useableErrors);
					$rootScope.$broadcast('auth.error', response);
				}

				throw (response.data) ? response.data : response;
			}

			this.provideToken = provideToken;
			this.requireLogin = requireLogin;
			this.isTokenExpired = isTokenExpired;
			this.isRefreshExpired = isRefreshExpired;

			this.isLoggedIn = function() {
				return Identity.isLoggedIn();
			};

			$rootScope.$on('identity.disconnect', this.logout);

			this.logout = function() {
				$localStorage.session.user_id = null;
				$localStorage.session.token = null;
				$localStorage.session.token_expires_at = null;
				$localStorage.session.refresh_expires_at = null;

				Identity.clearSession();
			};

			this.login = function(email, password) {

				let tokenRequest = {
					grant_type: 'login',
					email: email,
					password: password
				};

				let options = {
					accept: 'application/json',
				};

				return $http
					.post(API.getTokenURI(), tokenRequest, options)
					.then(handleAuthResponse, handleAuthError);
			};

			this.refresh = function() {

				let tokenRequest = {
					grant_type: 'refresh',
					token: $localStorage.session.token
				};

				let options = {
					accept: 'application/json',
				};

				return $http
					.post(API.getTokenURI(), tokenRequest, options)
					.then(handleAuthResponse, handleAuthError);
			};

		})
		.run(function (Identity, Users, Auth) {
			Identity.setTokenProvider(Auth.provideToken);
			Identity.setUserProvider(function(user_id) {
				if(!user_id) return;
				return Users.find({id: user_id, with: 'tenant'});
			});

			Identity.setup();
		})

})();