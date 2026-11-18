using Microsoft.EntityFrameworkCore.Storage;
using Pakpost.Application.Common.Interfaces;

namespace Pakpost.Infrastructure.Persistence;

internal sealed class EfTransactionScope(IDbContextTransaction transaction) : ITransactionScope
{
    public Task CommitAsync(CancellationToken cancellationToken) =>
        transaction.CommitAsync(cancellationToken);

    public ValueTask DisposeAsync() => transaction.DisposeAsync();
}
