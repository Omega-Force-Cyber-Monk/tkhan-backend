export const paginate = (page = 1, limit = 20) => ({
  skip: (page - 1) * limit,
  take: limit,
});

export const paginated = <T>(
  items: T[],
  total: number,
  page = 1,
  limit = 20,
) => ({
  items,
  meta: {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  },
});
