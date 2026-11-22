using System.Text.Json;
using FluentValidation;
using FluentValidation.Results;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using Pakpost.Api.Middlewares;
using Pakpost.Application.Common.Exceptions;

namespace Pakpost.UnitTests;

public sealed class GlobalExceptionMiddlewareTests
{
    [Fact]
    public async Task ApplicationExceptionsKeepStatusCodeAndMessage()
    {
        var (status, json) = await InvokeAsync(
            _ => throw AppException.Forbidden("Missing permission"));

        Assert.Equal(403, status);

        using var payload = JsonDocument.Parse(json);
        Assert.Equal("Missing permission", payload.RootElement.GetProperty("message").GetString());
    }

    [Fact]
    public async Task ValidationErrorsKeepFieldAndMessage()
    {
        var error = new ValidationException(
        [
            new ValidationFailure("Name", "Name is required")
        ]);

        var (status, json) = await InvokeAsync(_ => throw error);

        Assert.Equal(400, status);

        using var payload = JsonDocument.Parse(json);
        Assert.Equal("Validation failed", payload.RootElement.GetProperty("message").GetString());

        var details = payload.RootElement.GetProperty("errors");
        Assert.Equal("Name", details[0].GetProperty("field").GetString());
        Assert.Equal("Name is required", details[0].GetProperty("message").GetString());
    }

    [Fact]
    public async Task OptimisticConcurrencyConflictsKeepResponseContract()
    {
        var (status, json) = await InvokeAsync(
            _ => throw new DbUpdateConcurrencyException("Stale entity"));

        Assert.Equal(409, status);

        using var payload = JsonDocument.Parse(json);
        Assert.Equal(
            "Resource changed; refresh and retry",
            payload.RootElement.GetProperty("message").GetString());
    }

    [Theory]
    [InlineData("40001")]
    [InlineData("40P01")]
    [InlineData("23503")]
    [InlineData("23505")]
    public async Task PostgresMutationConflictsReturnSafeHttp409(string sqlState)
    {
        var postgres = new PostgresException(
            "private database error detail",
            "ERROR",
            "ERROR",
            sqlState);

        var (status, json) = await InvokeAsync(_ => throw postgres);

        Assert.Equal(409, status);
        Assert.DoesNotContain("private database error detail", json);
    }

    [Fact]
    public async Task UnrecognizedSqlStateStillReturnsSafeHttp500()
    {
        var postgres = new PostgresException(
            "private SQL error",
            "ERROR",
            "ERROR",
            "42601");

        var (status, json) = await InvokeAsync(_ => throw postgres);

        Assert.Equal(500, status);
        Assert.DoesNotContain("private SQL error", json);
    }

    [Theory]
    [InlineData("08006")]
    [InlineData("53300")]
    [InlineData("57P03")]
    public async Task TemporaryPostgresFailuresReturnSafeHttp503(string sqlState)
    {
        var postgres = new PostgresException(
            "private database connection detail", "ERROR", "ERROR", sqlState);
        var (status, json) = await InvokeAsync(_ => throw postgres);

        Assert.Equal(503, status);
        Assert.Contains("temporarily unavailable", json);
        Assert.DoesNotContain("private database connection detail", json);
    }

    [Fact]
    public async Task NpgsqlTransportFailureReturnsHttp503()
    {
        var (status, json) = await InvokeAsync(
            _ => throw new NpgsqlException("private network detail"));

        Assert.Equal(503, status);
        Assert.DoesNotContain("private network detail", json);
    }

    [Fact]
    public async Task RequestTimeoutReturnsSafeHttp504()
    {
        var (status, json) = await InvokeAsync(
            _ => throw new TimeoutException("private request detail"));

        Assert.Equal(504, status);
        Assert.DoesNotContain("private request detail", json);
    }

    [Fact]
    public async Task WrappedPostgresConflictReturnsHttp409()
    {
        var postgres = new PostgresException(
            "private constraint detail",
            "ERROR",
            "ERROR",
            "23505");

        var (status, json) = await InvokeAsync(_ =>
            throw new DbUpdateException("Save failed", postgres));

        Assert.Equal(409, status);
        Assert.DoesNotContain("private constraint detail", json);
    }

    [Fact]
    public async Task UnexpectedExceptionsNeverExposeInternalDetails()
    {
        var (status, json) = await InvokeAsync(
            _ => throw new InvalidOperationException("private connection detail"));

        Assert.Equal(500, status);

        using var payload = JsonDocument.Parse(json);
        Assert.Equal("Internal server error", payload.RootElement.GetProperty("message").GetString());
        Assert.DoesNotContain("private connection detail", json);
    }

    private static async Task<(int Status, string Body)> InvokeAsync(RequestDelegate next)
    {
        using var services = new ServiceCollection()
            .AddLogging()
            .AddOptions()
            .BuildServiceProvider();

        var context = new DefaultHttpContext
        {
            RequestServices = services
        };

        await using var output = new MemoryStream();
        context.Response.Body = output;

        var middleware = new GlobalExceptionMiddleware(
            next,
            NullLogger<GlobalExceptionMiddleware>.Instance);

        await middleware.InvokeAsync(context);

        output.Position = 0;

        using var reader = new StreamReader(output);
        return (context.Response.StatusCode, await reader.ReadToEndAsync());
    }
}
