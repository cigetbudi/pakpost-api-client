using System.Net;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Pakpost.Application.Common.Exceptions;

namespace Pakpost.Api.Middlewares;

public sealed class GlobalExceptionMiddleware(
    RequestDelegate next,
    ILogger<GlobalExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
        }
        catch (Exception ex)
        {
            if (context.Response.HasStarted)
            {
                logger.LogError(ex, "Request failed after the response started");
                throw;
            }

            var (statusCode, response) = MapException(ex);

            if (IsTemporaryDatabaseFailure(ex))
            {
                if (HttpMethods.IsGet(context.Request.Method) || HttpMethods.IsHead(context.Request.Method))
                    context.Response.Headers["Retry-After"] = "3";
                logger.LogWarning(
                    "PostgreSQL temporarily unavailable; {ExceptionType} {SqlState}",
                    ex.GetType().Name,
                    GetSqlState(ex));
            }
            else if (ex is DbUpdateConcurrencyException)
            {
                logger.LogWarning("Concurrent update conflict");
            }
            else if (IsDatabaseConflict(ex))
            {
                logger.LogWarning("Database mutation conflict {SqlState}", GetSqlState(ex));
            }
            else if (ex is not ValidationException and not AppException)
            {
                logger.LogError(ex, "Unhandled request error");
            }

            context.Response.StatusCode = statusCode;
            await context.Response.WriteAsJsonAsync(response);
        }
    }

    private static (int StatusCode, object Response) MapException(Exception exception)
    {
        return exception switch
        {
            ValidationException validation => (
                (int)HttpStatusCode.BadRequest,
                new
                {
                    message = "Validation failed",
                    errors = validation.Errors.Select(error => new
                    {
                        field = error.PropertyName,
                        message = error.ErrorMessage
                    })
                }),

            AppException application => (
                application.StatusCode,
                new { message = application.Message }),

            DbUpdateConcurrencyException => (
                (int)HttpStatusCode.Conflict,
                new { message = "Resource changed; refresh and retry" }),

            _ when IsDatabaseConflict(exception) => (
                (int)HttpStatusCode.Conflict,
                new { message = "Database conflict; refresh and retry" }),

            _ when IsTemporaryDatabaseFailure(exception) => (
                (int)HttpStatusCode.ServiceUnavailable,
                new { message = "Database temporarily unavailable; retry shortly" }),

            _ when exception is TimeoutException || GetSqlState(exception) == "57014" => (
                (int)HttpStatusCode.GatewayTimeout,
                new { message = "Request timed out" }),

            _ => (
                (int)HttpStatusCode.InternalServerError,
                new { message = "Internal server error" })
        };
    }

    private static bool IsTemporaryDatabaseFailure(Exception exception)
    {
        if (IsDatabaseConflict(exception))
            return false;

        return exception switch
        {
            DbUpdateException { InnerException: { } inner } => IsTemporaryDatabaseFailure(inner),
            PostgresException postgres =>
                postgres.SqlState.StartsWith("08", StringComparison.Ordinal) ||
                postgres.SqlState is "53300" or "53400" or "57P01" or "57P02" or "57P03",
            NpgsqlException => true,
            _ => false
        };
    }

    private static bool IsDatabaseConflict(Exception exception) =>
        GetSqlState(exception) is "23503" or "23505" or "40001" or "40P01";

    private static string? GetSqlState(Exception exception) => exception switch
    {
        PostgresException postgres => postgres.SqlState,
        DbUpdateException { InnerException: PostgresException inner } => inner.SqlState,
        _ => null
    };
}
