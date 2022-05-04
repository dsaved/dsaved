const GeneralController = require('../controllers/gen')
const AuthController = require('../controllers/auth')
const AdminController = require('../controllers/admin');
const authorizer = require('./authorizer')
const AccountController = require('../controllers/accounts')

module.exports = function(app) {

    //Authentication Routes
    app.post('/login', AuthController.login)

    //Account routes
    app.post('/account', authorizer, AccountController.userInfo)
    app.post('/account/update', authorizer, AccountController.userUpdate)
    app.post('/account/update-password', authorizer, AccountController.userUpdatePassword)

    //Admin user section
    app.post('/admin/get-users', authorizer, AdminController.getAdminUsers)
    app.post('/admin/get-user', authorizer, AdminController.getAdminUser)
    app.post('/admin/users-create', authorizer, AdminController.createAdmin)
    app.post('/admin/users-update', authorizer, AdminController.updateAdmin)
    app.post('/admin/delete-user', authorizer, AdminController.deleteAdmin)

    //Admin role section
    app.post('/role-options', authorizer, GeneralController.roleOptions)
    app.post('/admin/dashboard', authorizer, AdminController.getDashboardData)
    app.post('/admin/get-roles', authorizer, AdminController.getRoles)
    app.post('/admin/get-role', authorizer, AdminController.getRole)
    app.post('/admin/delete-role', authorizer, AdminController.deleteRole)
    app.post('/admin/add-role', authorizer, AdminController.addRole)
    app.post('/admin/update-role', authorizer, AdminController.updateRole)
    app.post('/admin/change-password', authorizer, AdminController.updatePassword)
}