// models/User.model.js
const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/db");
const bcrypt = require("bcryptjs");

class User extends Model {
  // Instance method to compare password
  async comparePassword(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
  }

  // Instance method to hash password
  async hashPassword() {
    if (this.password) {
      this.password = await bcrypt.hash(this.password, 12);
    }
  }
}

User.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    company_id: { 
      type: DataTypes.BIGINT, 
      allowNull: true,
      references: { model: "companies", key: "id" } 
    },
    name: { type: DataTypes.STRING(255), allowNull: false },
    email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    password: { type: DataTypes.STRING(255), allowNull: false },
    role: { 
      type: DataTypes.ENUM("super_admin", "company_admin", "hr", "employee"), 
      allowNull: false, 
      defaultValue: "employee" 
    },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    last_login: { type: DataTypes.DATE, allowNull: true },
    refresh_token: { type: DataTypes.STRING(500), allowNull: true },
    created_by: { type: DataTypes.BIGINT, allowNull: true },
    updated_by: { type: DataTypes.BIGINT, allowNull: true },
    is_deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    sequelize,
    modelName: "User",
    tableName: "users",
    timestamps: true,
    underscored: true,
    paranoid: false,
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          user.password = await bcrypt.hash(user.password, 12);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed("password") && user.password) {
          user.password = await bcrypt.hash(user.password, 12);
        }
      },
    },
    indexes: [
      { fields: ["email"] },
      { fields: ["company_id"] },
      { fields: ["role"] },
      { fields: ["is_active"] },
    ],
    defaultScope: {
      attributes: { exclude: ["password"] },
    },
    scopes: {
      withPassword: {
        attributes: { include: ["password"] },
      },
    },
  }
);

module.exports = User;