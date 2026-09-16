import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaMssql } from '@prisma/adapter-mssql'
import bcrypt from 'bcryptjs'
import { PERMISSIONS, ROLE_TEMPLATES } from '../src/lib/permissions.ts'

function parseUrl(url: string) {
  const [hostPart, ...pairs] = url.replace(/^sqlserver:\/\//, '').split(';')
  const [server, port] = hostPart.split(':')
  const params = new Map<string, string>()
  for (const pair of pairs) {
    const i = pair.indexOf('=')
    if (i > 0) params.set(pair.slice(0, i).toLowerCase(), pair.slice(i + 1))
  }
  return {
    server,
    port: port ? Number(port) : 1433,
    database: params.get('database'),
    user: params.get('user'),
    password: params.get('password'),
    options: { encrypt: true, trustServerCertificate: true },
  }
}

const db = new PrismaClient({
  adapter: new PrismaMssql(parseUrl(process.env.DATABASE_URL!)),
})

async function main() {
  console.log('Seeding SAIPEI POS…')

  // --- Permissions ---------------------------------------------------------
  for (const permission of PERMISSIONS) {
    await db.permission.upsert({
      where: { code: permission.code },
      update: { module: permission.module, label: permission.label },
      create: permission,
    })
  }
  const allPermissions = await db.permission.findMany()
  const permissionByCode = new Map(allPermissions.map((p) => [p.code, p.id]))
  console.log(`  permissions: ${allPermissions.length}`)

  // --- Roles ---------------------------------------------------------------
  for (const [name, template] of Object.entries(ROLE_TEMPLATES)) {
    const role = await db.role.upsert({
      where: { name },
      update: { description: template.description },
      create: { name, description: template.description, isSystem: true },
    })

    await db.rolePermission.deleteMany({ where: { roleId: role.id } })
    await db.rolePermission.createMany({
      data: template.permissions
        .map((code) => permissionByCode.get(code))
        .filter((id): id is string => Boolean(id))
        .map((permissionId) => ({ roleId: role.id, permissionId })),
    })
  }
  console.log(`  roles: ${Object.keys(ROLE_TEMPLATES).length}`)

  const roles = await db.role.findMany()
  const roleByName = new Map(roles.map((r) => [r.name, r.id]))

  // --- Branch & warehouses -------------------------------------------------
  const branch = await db.branch.upsert({
    where: { code: 'HQ' },
    update: {},
    create: { code: 'HQ', name: 'Head Office', location: 'Nairobi, Kenya' },
  })

  const mainStore = await db.warehouse.upsert({
    where: { code: 'MAIN' },
    update: {},
    create: {
      code: 'MAIN',
      name: 'Main Warehouse',
      location: 'Nairobi',
      branchId: branch.id,
      isDefault: true,
    },
  })
  await db.warehouse.upsert({
    where: { code: 'SHOP' },
    update: {},
    create: {
      code: 'SHOP',
      name: 'Retail Shop',
      location: 'Nairobi CBD',
      branchId: branch.id,
    },
  })

  // --- Users ---------------------------------------------------------------
  const users = [
    { username: 'admin', fullName: 'System Administrator', email: 'admin@saipeifoods.co.ke', role: 'Administrator', password: 'Admin@2026' },
    { username: 'wmusili', fullName: 'Wycliffe Musili', email: 'director@saipeifoods.co.ke', role: 'Director', password: 'Director@2026' },
    { username: 'accounts', fullName: 'Grace Wanjiru', email: 'accounts@saipeifoods.co.ke', role: 'Accountant', password: 'Accounts@2026' },
    { username: 'store', fullName: 'Peter Otieno', email: 'store@saipeifoods.co.ke', role: 'Store Keeper', password: 'Store@2026' },
    { username: 'cashier', fullName: 'Mary Achieng', email: 'cashier@saipeifoods.co.ke', role: 'Cashier', password: 'Cashier@2026' },
  ]

  for (const user of users) {
    const roleId = roleByName.get(user.role)
    if (!roleId) continue
    await db.user.upsert({
      where: { username: user.username },
      update: { fullName: user.fullName, roleId, isActive: true },
      create: {
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        passwordHash: bcrypt.hashSync(user.password, 10),
        roleId,
        branchId: branch.id,
      },
    })
  }
  console.log(`  users: ${users.length}`)

  // --- Reference data ------------------------------------------------------
  const categories = ['Shoes - Men', 'Shoes - Ladies', 'Shoes - Children', 'Sandals', 'Sports Shoes']
  for (const name of categories) {
    await db.category.upsert({ where: { name }, update: {}, create: { name } })
  }
  const categoryRows = await db.category.findMany()

  const expenseCategories = ['Transport', 'Warehouse Rent', 'Salaries', 'Utilities', 'Clearing Charges', 'Office Supplies', 'Licences & Permits']
  for (const name of expenseCategories) {
    await db.expenseCategory.upsert({ where: { name }, update: {}, create: { name } })
  }

  await db.supplier.upsert({
    where: { code: 'SUP-001' },
    update: {},
    create: {
      code: 'SUP-001',
      name: 'Guangzhou Footwear Trading Co. Ltd',
      type: 'FOREIGN',
      country: 'China',
      contactName: 'Li Wei',
      email: 'sales@gzfootwear.cn',
      currency: 'USD',
    },
  })

  await db.clearingAgent.upsert({
    where: { code: 'CA-001' },
    update: {},
    create: {
      code: 'CA-001',
      name: 'Mombasa Freight & Clearing Ltd',
      contactName: 'Hassan Ali',
      phone: '+254 722 000 111',
      taxPin: 'P051234567X',
    },
  })

  await db.customer.upsert({
    where: { code: 'CUS-000' },
    update: {},
    create: { code: 'CUS-000', name: 'Walk-in Customer', creditLimit: 0 },
  })

  // --- Products with opening stock ----------------------------------------
  const products = [
    { sku: 'SH-M-001', name: "Men's Leather Shoes - Black", category: 'Shoes - Men', cost: 850, price: 1800, qty: 120 },
    { sku: 'SH-M-002', name: "Men's Official Shoes - Brown", category: 'Shoes - Men', cost: 900, price: 1950, qty: 84 },
    { sku: 'SH-L-001', name: "Ladies' Flat Shoes - Assorted", category: 'Shoes - Ladies', cost: 620, price: 1400, qty: 160 },
    { sku: 'SH-L-002', name: "Ladies' Heels - Assorted", category: 'Shoes - Ladies', cost: 780, price: 1750, qty: 45 },
    { sku: 'SH-C-001', name: "Children's School Shoes", category: 'Shoes - Children', cost: 450, price: 1100, qty: 210 },
    { sku: 'SD-001', name: 'Rubber Sandals - Assorted', category: 'Sandals', cost: 180, price: 450, qty: 340 },
    { sku: 'SP-001', name: 'Sports Shoes - Running', category: 'Sports Shoes', cost: 1100, price: 2400, qty: 18 },
    { sku: 'SP-002', name: 'Canvas Shoes - Assorted', category: 'Sports Shoes', cost: 520, price: 1250, qty: 6 },
  ]

  for (const item of products) {
    const categoryId = categoryRows.find((c) => c.name === item.category)?.id
    const product = await db.product.upsert({
      where: { sku: item.sku },
      update: { sellingPrice: item.price, costPrice: item.cost },
      create: {
        sku: item.sku,
        name: item.name,
        categoryId,
        unit: 'PAIR',
        costPrice: item.cost,
        sellingPrice: item.price,
        reorderLevel: 20,
        taxRate: 16,
      },
    })

    await db.stockLevel.upsert({
      where: {
        productId_warehouseId: { productId: product.id, warehouseId: mainStore.id },
      },
      update: { quantity: item.qty },
      create: {
        productId: product.id,
        warehouseId: mainStore.id,
        quantity: item.qty,
      },
    })
  }
  console.log(`  products: ${products.length}`)

  // --- Settings ------------------------------------------------------------
  const settings: [string, string, string][] = [
    ['company.name', 'SAIPEI FOODS LIMITED', 'company'],
    ['company.tagline', 'From Kenya with Love', 'company'],
    ['company.phone', '+254 787 088567', 'company'],
    ['company.address', 'Nairobi, Kenya', 'company'],
    ['tax.vatRate', '16', 'tax'],
    ['mpesa.shortcode', '5606927', 'mpesa'],
    ['mpesa.type', 'BUY_GOODS', 'mpesa'],
    ['pos.receiptFooter', 'Thank you for shopping with SAIPEI FOODS LIMITED', 'pos'],
  ]
  for (const [key, value, group] of settings) {
    await db.setting.upsert({
      where: { key },
      update: { value, group },
      create: { key, value, group },
    })
  }

  console.log('Seed complete.')
  console.log('  Sign in as  admin / Admin@2026')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
